export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type SubscribeBody = {
  merchantId?: unknown;
  url?: unknown;
  eventType?: unknown;
};

type WebhookSubscriptionInput = {
  merchantId: string;
  url: string;
  eventType: string;
};

export async function POST(request: Request) {
  try {
    // Guard malformed JSON so it maps to a 400 rather than a generic 500.
    const body = (await request.json().catch(() => {
      throw new RouteValidationError("Request body must be valid JSON");
    })) as SubscribeBody;
    const input = parseSubscribeBody(body);
    const secret = generateWebhookSecret();
    const subscription = await prisma.webhookSubscription.upsert({
      where: {
        merchantId_url_eventType: {
          merchantId: input.merchantId,
          url: input.url,
          eventType: input.eventType,
        },
      },
      update: {
        secret,
        isActive: true,
      },
      create: {
        merchantId: input.merchantId,
        url: input.url,
        eventType: input.eventType,
        secret,
      },
    });

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error("Webhook subscription route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: getErrorStatus(error) }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantId = parseRequiredString(searchParams.get("merchantId"), "merchantId");
    // Never return `secret` in list responses — it is only shown once at
    // subscription time so callers can store it for signature verification.
    const subscriptions = await prisma.webhookSubscription.findMany({
      where: {
        merchantId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        merchantId: true,
        url: true,
        eventType: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error("Webhook subscription list route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: getErrorStatus(error) }
    );
  }
}

function parseSubscribeBody(body: SubscribeBody): WebhookSubscriptionInput {
  const merchantId = parseRequiredString(body.merchantId, "merchantId");
  const url = parseWebhookUrl(body.url);
  const eventType = parseRequiredString(body.eventType, "eventType");

  return {
    merchantId,
    url,
    eventType,
  };
}

function parseRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RouteValidationError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function parseWebhookUrl(value: unknown) {
  const url = parseRequiredString(value, "url");

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new RouteValidationError("url must use http or https");
    }

    return parsedUrl.toString();
  } catch (error) {
    if (error instanceof RouteValidationError) {
      throw error;
    }

    throw new RouteValidationError("url must be a valid URL");
  }
}

function generateWebhookSecret() {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

function getErrorStatus(error: unknown) {
  return error instanceof RouteValidationError ? 400 : 500;
}

class RouteValidationError extends Error {}
