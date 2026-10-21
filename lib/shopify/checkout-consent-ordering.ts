import { appendFileSync } from "node:fs"

import { supabaseAdmin } from "@/lib/supabase"

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
const ORDERING_RPC = "apply_shopify_checkout_marketing_consent"

type ConsentValue = boolean | undefined

type ApplyConsentInput = {
  cartId: string
  payloadUpdatedAt: unknown
  smsConsent: ConsentValue
  emailConsent: ConsentValue
}

type ConsentClient = Pick<typeof supabaseAdmin, "from" | "rpc">

export type ConsentApplyResult = {
  mode: "atomic" | "fallback_revocation" | "ignored_positive_without_migration" | "no_fields"
  eventAt: string | null
}

/** Accept only timezone-qualified Shopify timestamps that are not implausibly future-dated. */
export function parseShopifyCheckoutUpdatedAt(
  value: unknown,
  nowMs = Date.now()
): string | null {
  if (typeof value !== "string") return null
  const text = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) {
    return null
  }
  const timestamp = Date.parse(text)
  if (!Number.isFinite(timestamp) || timestamp > nowMs + MAX_FUTURE_SKEW_MS) return null
  return new Date(timestamp).toISOString()
}

export function isMissingConsentOrderingMigration(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const row = error as { code?: unknown; message?: unknown }
  const code = typeof row.code === "string" ? row.code : ""
  const message = typeof row.message === "string" ? row.message : ""
  return (
    code === "PGRST202" ||
    code === "42883" ||
    (/schema cache|function/i.test(message) && message.includes(ORDERING_RPC))
  )
}

/**
 * Apply both checkout consent fields in one database statement. The SQL RPC
 * serializes concurrent row updates and compares Shopify's source timestamp.
 *
 * During a code-before-migration rollout, only revocations are written through
 * the legacy columns; positive consent fails closed until the RPC is available.
 */
export async function applyShopifyCheckoutMarketingConsent(
  input: ApplyConsentInput,
  {
    client = supabaseAdmin,
    nowMs = Date.now(),
  }: {
    client?: ConsentClient
    nowMs?: number
  } = {}
): Promise<ConsentApplyResult> {
  const hasSms = typeof input.smsConsent === "boolean"
  const hasEmail = typeof input.emailConsent === "boolean"
  if (!hasSms && !hasEmail) return { mode: "no_fields", eventAt: null }

  const eventAt = parseShopifyCheckoutUpdatedAt(input.payloadUpdatedAt, nowMs)
  // #region agent log
  appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "FIX-A", location: "lib/shopify/checkout-consent-ordering.ts:67", message: "atomic consent apply entry", data: { cartId: input.cartId, eventAt, smsConsent: input.smsConsent ?? null, emailConsent: input.emailConsent ?? null }, timestamp: Date.now() }) + "\n")
  // #endregion
  const { error } = await client.rpc(ORDERING_RPC, {
    p_cart_id: input.cartId,
    p_event_at: eventAt,
    p_sms_consent: hasSms ? input.smsConsent : null,
    p_email_consent: hasEmail ? input.emailConsent : null,
  })
  // #region agent log
  appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "FIX-A,B", location: "lib/shopify/checkout-consent-ordering.ts:79", message: "atomic consent apply result", data: { cartId: input.cartId, eventAt, ok: !error, missingMigration: isMissingConsentOrderingMigration(error) }, timestamp: Date.now() }) + "\n")
  // #endregion

  if (!error) return { mode: "atomic", eventAt }
  if (!isMissingConsentOrderingMigration(error)) throw error

  const revocations: Record<string, false> = {}
  if (input.smsConsent === false) revocations.sms_marketing_consent = false
  if (input.emailConsent === false) revocations.email_marketing_consent = false

  if (Object.keys(revocations).length === 0) {
    console.warn("Shopify positive marketing consent ignored until ordering migration is applied")
    return { mode: "ignored_positive_without_migration", eventAt }
  }

  const { error: fallbackError } = await client
    .from("abandoned_carts")
    .update(revocations)
    .eq("id", input.cartId)
    .in("status", ["pending", "messaged"])
  // #region agent log
  appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "FIX-C", location: "lib/shopify/checkout-consent-ordering.ts:102", message: "migration fallback revocation result", data: { cartId: input.cartId, smsRevoked: input.smsConsent === false, emailRevoked: input.emailConsent === false, ok: !fallbackError }, timestamp: Date.now() }) + "\n")
  // #endregion
  if (fallbackError) throw fallbackError

  console.warn("Shopify consent ordering migration missing; applied revocation-only fallback")
  return { mode: "fallback_revocation", eventAt }
}
