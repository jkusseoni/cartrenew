export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  parseLifetimeDealTier,
  type LifetimeDealTierKey,
} from "@/lib/ltd-tiers";
import { prisma } from "@/lib/prisma";
const TRACKING_PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
  "ttclid",
  "ref",
  "referral",
  "merchantId",
  "storeId",
  "cartId",
  "sessionId",
] as const;

type TrackingParamKey = (typeof TRACKING_PARAM_KEYS)[number];
type HandshakeTrackingParams = Partial<Record<TrackingParamKey, string>>;

type HandshakeAuthContext = {
  clerkEnabled: boolean;
  userId: string | null;
};

type HandshakePayload = {
  activeTier: LifetimeDealTierKey | null;
  clientTimestamp: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  pathname: string | null;
  trackingParams: HandshakeTrackingParams;
};

type HandshakeUserContext = {
  email: string;
  firstName: string | null;
  lastName: string | null;
};

class HandshakeRouteError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HandshakeRouteError";
    this.status = status;
  }
}

const skipClerk =
  process.env.NODE_ENV === "development" ||
  process.env.SKIP_CLERK === "true" ||
  process.env.NEXT_PUBLIC_SKIP_CLERK === "true";

export async function POST(req: Request) {
  try {
    const authContext = await getHandshakeAuthContext();

    if (!authContext.userId) {
      return NextResponse.json({ error: "Unauthorized handshake block." }, { status: 401 });
    }

    const payload = await parseHandshakePayload(req);
    const userContext = await getHandshakeUserContext(authContext, payload);
    const syncedAt = new Date().toISOString();

    await prisma.user.upsert({
      create: {
        email: userContext.email,
        firstName: userContext.firstName,
        id: authContext.userId,
        lastName: userContext.lastName,
      },
      update: {
        email: userContext.email,
        firstName: userContext.firstName,
        lastName: userContext.lastName,
      },
      where: { id: authContext.userId },
    });

    const merchant = await synchronizeMerchantContext(
      authContext.userId,
      payload,
      syncedAt
    );

    return NextResponse.json({
      activeTier: merchant.activeTier,
      handshakeToken: authContext.userId,
      merchantId: merchant.id,
      success: true,
      syncedAt,
      trackingParams: payload.trackingParams,
    });
  } catch (error: unknown) {
    const status = error instanceof HandshakeRouteError ? error.status : 500;
    const message =
      error instanceof HandshakeRouteError
        ? error.message
        : "Handshake execution loop dropped.";

    console.error("Merchant handshake failed:", getErrorMessage(error));

    return NextResponse.json({ error: message }, { status });
  }
}

async function getHandshakeAuthContext(): Promise<HandshakeAuthContext> {
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

async function parseHandshakePayload(req: Request): Promise<HandshakePayload> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    throw new HandshakeRouteError("Request body must be valid JSON.", 400);
  }

  if (!isPlainObject(body)) {
    throw new HandshakeRouteError("Request body must be a JSON object.", 400);
  }

  return {
    activeTier: parseOptionalTier(body.activeTier),
    clientTimestamp: parseOptionalIsoDate(body.clientTimestamp, "clientTimestamp"),
    email: parseOptionalString(body.email, "email", 320),
    firstName: parseOptionalString(body.firstName, "firstName", 120),
    lastName: parseOptionalString(body.lastName, "lastName", 120),
    pathname: parseOptionalString(body.pathname, "pathname", 2048),
    trackingParams: parseTrackingParams(body.trackingParams),
  };
}

function parseOptionalTier(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const tier = parseLifetimeDealTier(value);

  if (!tier) {
    throw new HandshakeRouteError("activeTier must be SINGLE, DOUBLE, or MULTIPLE.", 400);
  }

  return tier;
}

function parseTrackingParams(value: unknown): HandshakeTrackingParams {
  if (value === undefined || value === null) {
    return {};
  }

  if (!isPlainObject(value)) {
    throw new HandshakeRouteError("trackingParams must be an object.", 400);
  }

  const candidate = value as Partial<Record<TrackingParamKey, unknown>>;
  const trackingParams: HandshakeTrackingParams = {};

  TRACKING_PARAM_KEYS.forEach((key) => {
    const paramValue = parseOptionalString(candidate[key], key, 240);

    if (paramValue) {
      trackingParams[key] = paramValue;
    }
  });

  return trackingParams;
}

function parseOptionalString(value: unknown, fieldName: string, maxLength: number) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HandshakeRouteError(`${fieldName} must be a string.`, 400);
  }

  const normalized = value.trim();

  return normalized ? normalized.slice(0, maxLength) : null;
}

function parseOptionalIsoDate(value: unknown, fieldName: string) {
  const normalized = parseOptionalString(value, fieldName, 80);

  if (!normalized) {
    return null;
  }

  if (Number.isNaN(Date.parse(normalized))) {
    throw new HandshakeRouteError(`${fieldName} must be a valid ISO date string.`, 400);
  }

  return normalized;
}

async function getHandshakeUserContext(
  authContext: HandshakeAuthContext,
  payload: HandshakePayload
): Promise<HandshakeUserContext> {
  const clerkUser = authContext.clerkEnabled ? await currentUser() : null;
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress?.trim() ||
    payload.email ||
    `clerk-${authContext.userId}@cartrenew.local`;

  return {
    email,
    firstName: normalizeNullableString(clerkUser?.firstName) || payload.firstName,
    lastName: normalizeNullableString(clerkUser?.lastName) || payload.lastName,
  };
}

async function synchronizeMerchantContext(
  userId: string,
  payload: HandshakePayload,
  syncedAt: string
) {
  const tierConfig = buildMerchantTierConfig(null, payload, syncedAt);
  const existingMerchant = await prisma.merchant.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      subscriptionTier: true,
      tierConfig: true,
    },
    where: { userId },
  });

  if (existingMerchant) {
    const nextTierConfig = buildMerchantTierConfig(
      existingMerchant.tierConfig,
      payload,
      syncedAt
    );

    const updatedMerchant = payload.activeTier
      ? await prisma.merchant.update({
          data: {
            subscriptionTier: payload.activeTier,
            tierConfig: nextTierConfig,
          },
          select: {
            id: true,
            subscriptionTier: true,
          },
          where: { id: existingMerchant.id },
        })
      : await prisma.merchant.update({
          data: {
            tierConfig: nextTierConfig,
          },
          select: {
            id: true,
            subscriptionTier: true,
          },
          where: { id: existingMerchant.id },
        });

    return {
      activeTier: updatedMerchant.subscriptionTier,
      id: updatedMerchant.id,
    };
  }

  const createdMerchant = payload.activeTier
    ? await prisma.merchant.create({
        data: {
          storeName: "CartRenew Handshake Store",
          subscriptionTier: payload.activeTier,
          tierConfig,
          userId,
        },
        select: {
          id: true,
          subscriptionTier: true,
        },
      })
    : await prisma.merchant.create({
        data: {
          storeName: "CartRenew Handshake Store",
          tierConfig,
          userId,
        },
        select: {
          id: true,
          subscriptionTier: true,
        },
      });

  return {
    activeTier: createdMerchant.subscriptionTier,
    id: createdMerchant.id,
  };
}

function buildMerchantTierConfig(
  existingValue: Prisma.JsonValue | null,
  payload: HandshakePayload,
  syncedAt: string
): Prisma.InputJsonObject {
  const existingConfig = isJsonObject(existingValue) ? existingValue : {};

  return {
    ...existingConfig,
    handshake: {
      activeTier: payload.activeTier,
      clientTimestamp: payload.clientTimestamp,
      pathname: payload.pathname,
      syncedAt,
      trackingParams: payload.trackingParams,
    },
  };
}

function isJsonObject(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
