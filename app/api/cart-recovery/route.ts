export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PENDING_STATUS = "pending";
const MAX_CARTS_PER_RUN = 25;

type CartProcessResult = {
  cartId: string;
  status: "processed" | "skipped" | "failed";
  messageId?: string | null;
  error?: string;
  reason?: string;
};

/**
 * GET /api/cart-recovery — Vercel cron worker (see vercel.json).
 *
 * This route does NOT receive Shopify webhook JSON.
 * Shopify Abandoned Checkout webhooks (checkouts/create|update) must POST to
 * /api/webhooks/shopify, which writes Supabase `abandoned_carts`.
 * This cron reads those rows with status=pending and sends Meta WhatsApp
 * (approved template abandoned_cart_reminder).
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
  const results: CartProcessResult[] = [];

  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    const {
      sendWhatsAppMessage,
      hasWhatsAppCredentials,
      buildAbandonedCartTemplateVariables,
      resolveRecoveryCustomerName,
      isValidWhatsAppPhone,
    } = await import("@/lib/services/whatsapp-meta");
    const { getTrackedRecoveryUrl } = await import("@/lib/recovery-link");

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

    const { data: abandonedCarts, error: fetchError } = await supabaseAdmin
      .from("abandoned_carts")
      .select(
        "id, store_id, customer_phone, customer_name, cart_value, items, checkout_url, status"
      )
      .eq("status", PENDING_STATUS)
      .order("updated_at", { ascending: true })
      .limit(MAX_CARTS_PER_RUN);

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    const pendingCarts = abandonedCarts ?? [];

    console.log("🗂️ /api/cart-recovery pending abandoned carts found:", {
      count: pendingCarts.length,
      cartIds: pendingCarts.map((cart) => cart.id),
    });

    for (const cart of pendingCarts) {
      // Atomic claim: only one cron run processes a given pending cart.
      const { data: claimedRows, error: claimError } = await supabaseAdmin
        .from("abandoned_carts")
        .update({ status: "messaged" })
        .eq("id", cart.id)
        .eq("status", PENDING_STATUS)
        .select("id");

      if (claimError) {
        results.push({
          cartId: cart.id,
          status: "failed",
          error: claimError.message,
        });
        continue;
      }

      if (!claimedRows?.length) {
        results.push({
          cartId: cart.id,
          status: "skipped",
          reason: "cart_already_processed_or_changed",
        });
        continue;
      }

      const customerPhone = cart.customer_phone?.trim();
      if (!customerPhone) {
        // Release claim so a later update with a phone can retry.
        await supabaseAdmin
          .from("abandoned_carts")
          .update({ status: PENDING_STATUS })
          .eq("id", cart.id);

        results.push({
          cartId: cart.id,
          status: "skipped",
          reason: "missing_phone",
        });
        continue;
      }

      // Shopify often stores placeholder phones like +15551212 — Twilio 21211.
      // Mark lost so cron does not infinite-retry invalid numbers.
      if (!isValidWhatsAppPhone(customerPhone)) {
        console.warn("⚠️ Skipping cart with invalid/placeholder phone", {
          cartId: cart.id,
          to: customerPhone,
        });

        await supabaseAdmin
          .from("abandoned_carts")
          .update({ status: "lost", updated_at: new Date().toISOString() })
          .eq("id", cart.id);

        results.push({
          cartId: cart.id,
          status: "skipped",
          reason: "invalid_phone",
        });
        continue;
      }

      try {
        const customerName = resolveRecoveryCustomerName(cart.customer_name);
        const checkoutUrl =
          (typeof cart.checkout_url === "string" && cart.checkout_url) ||
          getTrackedRecoveryUrl(cart.id);
        const bodyVariables = buildAbandonedCartTemplateVariables({
          customerName,
          checkoutUrl,
        });

        console.log("📤 Calling sendWhatsAppMessage for pending cart", {
          cartId: cart.id,
          to: customerPhone,
          status: cart.status,
          templateName: "abandoned_cart_reminder",
          bodyVariables,
        });

        const sendResult = await sendWhatsAppMessage(customerPhone, {
          templateName: "abandoned_cart_reminder",
          bodyVariables,
        });

        if (!sendResult.success) {
          await supabaseAdmin
            .from("abandoned_carts")
            .update({ status: PENDING_STATUS })
            .eq("id", cart.id);

          results.push({
            cartId: cart.id,
            status: "failed",
            error: sendResult.error || "whatsapp_send_failed",
          });
          continue;
        }

        await supabaseAdmin
          .from("abandoned_carts")
          .update({
            status: "messaged",
            message_sent_at: new Date().toISOString(),
          })
          .eq("id", cart.id);

        results.push({
          cartId: cart.id,
          status: "processed",
          messageId: sendResult.messageId ?? null,
        });
      } catch (error) {
        console.error(`Failed to send Meta WhatsApp for cart ${cart.id}:`, error);

        try {
          await supabaseAdmin
            .from("abandoned_carts")
            .update({ status: PENDING_STATUS })
            .eq("id", cart.id);
        } catch (releaseError) {
          console.error(`Failed to release claim for cart ${cart.id}:`, releaseError);
        }

        results.push({
          cartId: cart.id,
          status: "failed",
          error: getErrorMessage(error),
        });
      }
    }

    const processed = results.filter((result) => result.status === "processed").length;
    const failed = results.filter((result) => result.status === "failed").length;

    return NextResponse.json({
      success: failed === 0,
      message: processed > 0 ? "WhatsApp recovery messages sent" : "No pending carts to process",
      scanned: pendingCarts.length,
      processed,
      skipped: results.filter((result) => result.status === "skipped").length,
      failed,
      durationMs: Date.now() - startedAt,
      results,
    });
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
