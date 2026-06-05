import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  getLifetimeDealConfig,
  getLifetimeDealRules,
  parseLifetimeDealTier,
} from "@/lib/ltd-tiers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export async function POST(req: Request) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook receiver is not configured" },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature header" },
      { status: 400 }
    );
  }

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("Stripe webhook signature verification failed:", message);

    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const fulfillment = await fulfillCheckoutSession(session);

    return NextResponse.json(
      {
        eventId: event.id,
        received: true,
        ...fulfillment,
      },
      { status: fulfillment.success ? 200 : 422 }
    );
  }

  return NextResponse.json(
    {
      eventId: event.id,
      eventType: event.type,
      ignored: true,
      received: true,
    },
    { status: 200 }
  );
}

async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  const clerkUserId = getMetadataValue(session.metadata, "clerkUserId") || session.client_reference_id;
  const tier = parseLifetimeDealTier(
    getMetadataValue(session.metadata, "selectedTier") || getMetadataValue(session.metadata, "tier")
  );

  if (!clerkUserId || !tier) {
    return {
      error: "Missing Clerk user or LTD tier metadata",
      success: false,
    };
  }

  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return {
      error: `Checkout session is not paid: ${session.payment_status}`,
      success: false,
    };
  }

  const rules = getLifetimeDealRules(tier);
  const tierConfig = getLifetimeDealConfig(tier);
  const customerEmail =
    session.customer_details?.email ||
    getMetadataValue(session.metadata, "customerEmail") ||
    `clerk-${clerkUserId}@cartrenew.local`;
  const customerName = session.customer_details?.name || tierConfig.planLabel;
  const purchasedAt = new Date(session.created * 1000);
  const stripeCustomerId = getStripeId(session.customer);
  const stripePaymentIntentId = getStripeId(session.payment_intent);
  const entitlementData = {
    lifetimeDealActive: true,
    lifetimeDealPurchasedAt: purchasedAt,
    monthlyRecoveryLimit: rules.monthlyRecoveryLimit,
    storeLimit: rules.storeLimit,
    stripeCheckoutSessionId: session.id,
    stripeCustomerId,
    stripePaymentIntentId,
    subscriptionTier: tier,
    tierConfig,
  };

  await prisma.user.upsert({
    create: {
      email: customerEmail,
      firstName: getFirstName(customerName),
      id: clerkUserId,
      lastName: getLastName(customerName),
    },
    update: {
      email: customerEmail,
      firstName: getFirstName(customerName),
      lastName: getLastName(customerName),
    },
    where: { id: clerkUserId },
  });

  const updatedMerchants = await prisma.merchant.updateMany({
    data: entitlementData,
    where: { userId: clerkUserId },
  });

  if (updatedMerchants.count === 0) {
    await prisma.merchant.create({
      data: {
        ...entitlementData,
        storeName: `${tierConfig.planLabel} LTD Store`,
        userId: clerkUserId,
      },
    });
  }

  console.log("Stripe LTD checkout fulfilled:", {
    clerkUserId,
    sessionId: session.id,
    tier,
    updatedMerchants: Math.max(updatedMerchants.count, 1),
  });

  return {
    clerkUserId,
    config: tierConfig,
    sessionId: session.id,
    success: true,
    tier,
    updatedMerchants: Math.max(updatedMerchants.count, 1),
  };
}

function getMetadataValue(
  metadata: Stripe.Metadata | null,
  key: string
) {
  return metadata?.[key]?.trim() || "";
}

function getStripeId(value: string | { id: string } | null) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.id;
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/).at(0) || null;
}

function getLastName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return parts.length > 1 ? parts.slice(1).join(" ") : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
