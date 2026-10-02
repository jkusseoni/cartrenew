export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MAX_CARTS_PER_RUN = 25;
const MAX_RETRIES_PER_RUN = 25;

/**
 * GET /api/cart-recovery — Vercel cron worker (see vercel.json).
 *
 * This route does NOT receive Shopify webhook JSON.
 * Shopify Abandoned Checkout webhooks (checkouts/create|update) must POST to
 * /api/webhooks/shopify, which writes Supabase `abandoned_carts`.
 *
 * Each run (see lib/services/recovery-dispatch.ts):
 *   1. retries `messages` rows stuck in pending past next_retry_at (capped,
 *      then failed);
 *   2. sends the first reminder for recent pending carts never attempted.
 * Carts are marked 'messaged' only after the Graph API accepts a send.
 */
export async function GET(request: NextRequest) {
  console.log("⏰ /api/cart-recovery cron HIT (not a Shopify webhook receiver)", {
    method: request.method,
    url: request.url,
    hasAuthorization: Boolean(request.headers.get("authorization")),
    shopifyTopic: request.headers.get("x-shopify-topic"),
    note: "Shopify checkouts/update payloads belong on POST /api/webhooks/shopify",
  });

  const unauthorizedResponse = authorizeCronRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const startedAt = Date.now();

  try {
    const { hasWhatsAppCredentials } = await import("@/lib/services/whatsapp-meta");
    const { processDueRetries, processFirstAttempts } = await import(
      "@/lib/services/recovery-dispatch"
    );

    if (!hasWhatsAppCredentials()) {
      console.error("❌ WhatsApp credentials missing — aborting cart-recovery run");
      return NextResponse.json(
        {
          success: false,
          error: "WhatsApp credentials missing or placeholder",
          durationMs: Date.now() - startedAt,
        },
        { status: 500 }
      );
    }

    const retries = await processDueRetries({ limit: MAX_RETRIES_PER_RUN });
    const firstAttempts = await processFirstAttempts({ limit: MAX_CARTS_PER_RUN });
    const all = [...retries.results, ...firstAttempts];
    const count = (outcome: string) => all.filter((result) => result.outcome === outcome).length;

    const summary = {
      success: true,
      expiredRetries: retries.expired,
      retried: retries.results.length,
      firstAttempts: firstAttempts.length,
      sent: count("sent"),
      retryScheduled: count("retry_scheduled"),
      failed: count("failed"),
      skipped: count("skipped"),
      durationMs: Date.now() - startedAt,
    };
    console.log("🗂️ /api/cart-recovery run summary", summary);

    return NextResponse.json({ ...summary, retries: retries.results, results: firstAttempts });
  } catch (error) {
    console.error("Cart recovery cron route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}

function authorizeCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret && process.env.NODE_ENV !== "production") {
    return null;
  }

  if (!cronSecret) {
    return NextResponse.json(
      {
        success: false,
        error: "CRON_SECRET is not configured.",
      },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  return null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

/**
 * If Shopify (or a test client) POSTs here by mistake, log the payload so we can
 * see it — then point them at the real webhook route.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let parsed: unknown = null;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsed = null;
  }

  console.log("⚠️ POST /api/cart-recovery received — this is NOT the Shopify webhook endpoint", {
    topic: request.headers.get("x-shopify-topic"),
    shop: request.headers.get("x-shopify-shop-domain"),
    bodyLength: rawBody.length,
    rawBody,
    parsedPayload: parsed,
    correctEndpoint: "POST /api/webhooks/shopify",
  });

  return NextResponse.json(
    {
      success: false,
      error:
        "This endpoint is a cron worker (GET). Send Shopify checkouts/update webhooks to POST /api/webhooks/shopify.",
    },
    { status: 405 }
  );
}
