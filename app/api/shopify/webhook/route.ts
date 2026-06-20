export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Alias endpoint: POST /api/shopify/webhook
 *
 * Re-exports the canonical, fully-featured webhook handler from
 * `/api/webhooks/shopify`. Incoming abandoned-cart payloads are HMAC-validated
 * against the Shopify client secret (via lib/shopify/config) before the
 * CartAssist recovery flow is triggered. Keeping a single handler avoids
 * double-processing if both URLs are ever registered.
 */
export { POST } from "@/app/api/webhooks/shopify/route";
