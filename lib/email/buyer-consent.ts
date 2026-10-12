/**
 * Checkout marketing consent.
 *
 * Shopify's "Email me with news and offers" box is not always
 * `buyer_accepts_marketing`. On current checkout webhooks that boolean can
 * stay false while `customer.accepts_marketing` is true. Only real booleans
 * count. Missing fields return undefined so a later cart update does not
 * wipe a value already stored.
 */

export type CheckoutConsentSource = "buyer_accepts_marketing" | "customer.accepts_marketing" | null

export type CheckoutConsentRead = {
  value: boolean | undefined
  source: CheckoutConsentSource
  buyerAcceptsMarketing: boolean | null
  customerAcceptsMarketing: boolean | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function booleanField(record: Record<string, unknown> | null, key: string): boolean | undefined {
  if (!record) return undefined
  const value = record[key]
  return typeof value === "boolean" ? value : undefined
}

/** Top-level `customer` first, then a wrapped `payload.customer`. */
function readCustomerAcceptsMarketing(payload: Record<string, unknown>): boolean | undefined {
  const top = booleanField(asRecord(payload.customer), "accepts_marketing")
  if (top !== undefined) return top
  return booleanField(asRecord(asRecord(payload.payload)?.customer), "accepts_marketing")
}

export function readCheckoutMarketingConsent(payload: Record<string, unknown>): CheckoutConsentRead {
  const buyer = booleanField(payload, "buyer_accepts_marketing")
  const customer = readCustomerAcceptsMarketing(payload)

  let value: boolean | undefined
  let source: CheckoutConsentSource = null
  if (buyer === true) {
    value = true
    source = "buyer_accepts_marketing"
  } else if (customer === true) {
    value = true
    source = "customer.accepts_marketing"
  } else if (buyer === false) {
    value = false
    source = "buyer_accepts_marketing"
  } else if (customer === false) {
    value = false
    source = "customer.accepts_marketing"
  }

  return {
    value,
    source,
    buyerAcceptsMarketing: buyer ?? null,
    customerAcceptsMarketing: customer ?? null,
  }
}

export function readBuyerAcceptsMarketing(payload: Record<string, unknown>): boolean | undefined {
  return readCheckoutMarketingConsent(payload).value
}
