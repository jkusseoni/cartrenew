export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  getLifetimeDealConfig,
  getLifetimeDealRules,
  getStripePriceId,
  parseLifetimeDealTier,
  type LifetimeDealTierKey,
} from "@/lib/ltd-tiers";
import { prisma } from "@/lib/prisma";
const CHECKOUT_CURRENCIES = ["USD", "INR", "EUR", "GBP", "AED"] as const;
const DEFAULT_CHECKOUT_CURRENCY: CheckoutCurrency = "USD";
const STRIPE_CURRENCY_BY_CHECKOUT_CURRENCY: Record<CheckoutCurrency, StripeCurrency> = {
  AED: "aed",
  EUR: "eur",
  GBP: "gbp",
  INR: "inr",
  USD: "usd",
};

type CheckoutCurrency = (typeof CHECKOUT_CURRENCIES)[number];
type StripeCurrency = "aed" | "eur" | "gbp" | "inr" | "usd";

type CheckoutRequest = {
  currency: CheckoutCurrency;
  tier: LifetimeDealTierKey;
};

type CheckoutAuthContext = {
  clerkEnabled: boolean;
  userId: string | null;
};

type CheckoutUserContext = {
  email: string;
  firstName: string | null;
  lastName: string | null;
};

type StripePriceRoute = {
  currency: StripeCurrency;
  envKey: string;
  priceId: string;
};

class CheckoutRouteError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CheckoutRouteError";
    this.status = status;
  }
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const skipClerk =
  process.env.NODE_ENV === "development" ||
  process.env.SKIP_CLERK === "true" ||
  process.env.NEXT_PUBLIC_SKIP_CLERK === "true";

export async function POST(req: Request) {
  try {
    const authContext = await getCheckoutAuthContext();

    if (!authContext.userId) {
      return NextResponse.json({ error: "Unauthorized access detected." }, { status: 401 });
    }

    const checkoutRequest = await parseCheckoutRequest(req);
    const tierConfig = getLifetimeDealConfig(checkoutRequest.tier);

    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe checkout is not configured." },
        { status: 503 }
      );
    }

    const priceRoute = resolveStripePriceRoute(
      checkoutRequest.tier,
      checkoutRequest.currency
    );
    const userContext = await ensureCheckoutUserContext(
      authContext.userId,
      authContext.clerkEnabled
    );
    const origin = getCheckoutOrigin(req);

    const session = await stripe.checkout.sessions.create({
      client_reference_id: authContext.userId,
      customer_email: userContext.email,
      line_items: [
        {
          price: priceRoute.priceId,
          quantity: 1,
        },
      ],
      metadata: {
        checkoutCurrency: priceRoute.currency,
        clerkUserId: authContext.userId,
        priceEnv: priceRoute.envKey,
        selectedTier: checkoutRequest.tier,
        tier: checkoutRequest.tier,
      },
      mode: "payment",
      success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
    });

    if (!session.url) {
      throw new CheckoutRouteError("Stripe did not return a checkout URL.", 502);
    }

    console.log("Stripe LTD checkout session created:", {
      currency: priceRoute.currency,
      priceEnv: priceRoute.envKey,
      sessionId: session.id,
      tier: checkoutRequest.tier,
      userId: authContext.userId,
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      config: tierConfig,
      currency: priceRoute.currency,
      sessionId: session.id,
      success: true,
      tier: checkoutRequest.tier,
      url: session.url,
    });
  } catch (error: unknown) {
    const status = error instanceof CheckoutRouteError ? error.status : 500;
    const message =
      error instanceof CheckoutRouteError
        ? error.message
        : "Internal checkout pipeline failure.";

    console.error("Checkout route failed:", getErrorMessage(error));

    return NextResponse.json({ error: message }, { status });
  }
}

async function getCheckoutAuthContext(): Promise<CheckoutAuthContext> {
  if (skipClerk) {
    return {
      clerkEnabled: false,
      userId: "local-dev",
    };
  }

  const { userId } = await auth();

  return {
    clerkEnabled: true,
    userId,
  };
}

async function parseCheckoutRequest(req: Request): Promise<CheckoutRequest> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    throw new CheckoutRouteError("Request body must be valid JSON.", 400);
  }

  if (!isPlainObject(body)) {
    throw new CheckoutRouteError("Request body must be a JSON object.", 400);
  }

  const tier = parseLifetimeDealTier(body.tier);

  if (!tier) {
    throw new CheckoutRouteError(
      "Invalid Lifetime Deal configuration tier requested.",
      400
    );
  }

  return {
    currency: parseCheckoutCurrency(body.currencyCode ?? body.currency),
    tier,
  };
}

function parseCheckoutCurrency(value: unknown): CheckoutCurrency {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_CHECKOUT_CURRENCY;
  }

  if (typeof value !== "string") {
    throw new CheckoutRouteError("currencyCode must be a string.", 400);
  }

  const normalizedCurrency = value.trim().toUpperCase();

  if (isCheckoutCurrency(normalizedCurrency)) {
    return normalizedCurrency;
  }

  throw new CheckoutRouteError(
    `Unsupported checkout currency: ${normalizedCurrency || "(blank)"}.`,
    400
  );
}

function isCheckoutCurrency(value: string): value is CheckoutCurrency {
  return CHECKOUT_CURRENCIES.some((currency) => currency === value);
}

function resolveStripePriceRoute(
  tier: LifetimeDealTierKey,
  currency: CheckoutCurrency
): StripePriceRoute {
  const defaultPriceId = getStripePriceId(tier);
  const defaultEnvKey = getLifetimeDealRules(tier).priceEnv;
  const currencyEnvKey = `${defaultEnvKey}_${currency}`;
  const currencyPriceId = process.env[currencyEnvKey]?.trim();

  if (currencyPriceId) {
    return {
      currency: STRIPE_CURRENCY_BY_CHECKOUT_CURRENCY[currency],
      envKey: currencyEnvKey,
      priceId: currencyPriceId,
    };
  }

  if (currency === DEFAULT_CHECKOUT_CURRENCY && defaultPriceId) {
    return {
      currency: STRIPE_CURRENCY_BY_CHECKOUT_CURRENCY[currency],
      envKey: defaultEnvKey,
      priceId: defaultPriceId,
    };
  }

  throw new CheckoutRouteError(
    `Stripe price is not configured for ${tier} in ${currency}.`,
    503
  );
}

async function ensureCheckoutUserContext(
  clerkUserId: string,
  clerkEnabled: boolean
): Promise<CheckoutUserContext> {
  const user = clerkEnabled ? await currentUser() : null;
  const email =
    user?.primaryEmailAddress?.emailAddress?.trim() ||
    `clerk-${clerkUserId}@cartrenew.local`;
  const firstName = normalizeNullableString(user?.firstName);
  const lastName = normalizeNullableString(user?.lastName);

  await prisma.user.upsert({
    create: {
      email,
      firstName,
      id: clerkUserId,
      lastName,
    },
    update: {
      email,
      firstName,
      lastName,
    },
    where: { id: clerkUserId },
  });

  return {
    email,
    firstName,
    lastName,
  };
}

function getCheckoutOrigin(req: Request) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    return configuredSiteUrl.replace(/\/$/, "");
  }

  return new URL(req.url).origin;
}

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
