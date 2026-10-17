/**
 * WhatsApp opt-in from a Shopify checkout webhook.
 *
 * checkouts/create and checkouts/update carry `buyer_accepts_sms_marketing`
 * (the "Text me with news and offers" checkbox) and `sms_marketing_phone`
 * (the number entered for it) at the top level. Shopify has no WhatsApp
 * checkout checkbox, so Pingza treats this SMS marketing opt-in as the
 * shopper's consent to a WhatsApp reminder. Only a real boolean counts; a
 * missing field returns undefined so a later update does not wipe a stored
 * value.
 */

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asPhoneString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}

function firstPhone(values: unknown[]): string | null {
  for (const value of values) {
    const phone = asPhoneString(value)
    if (phone) return phone
  }
  return null
}

export function readCheckoutSmsMarketingConsent(
  payload: Record<string, unknown>
): boolean | undefined {
  const value = payload.buyer_accepts_sms_marketing
  return typeof value === "boolean" ? value : undefined
}

/**
 * CartRenew: shipping phone, customer phone, checkout phone, billing phone,
 * default address phone.
 * Pingza: the SMS opt-in phone and contact phones first. The shipping phone is
 * for delivery, so it is the last fallback.
 */
export function extractCheckoutPhone(
  payload: Record<string, unknown>,
  customer: Record<string, unknown>,
  { isDefaultBrand }: { isDefaultBrand: boolean }
): string | null {
  const billing = asRecord(payload.billing_address)
  const shipping = asRecord(payload.shipping_address)
  const defaultAddress = asRecord(customer.default_address)

  if (isDefaultBrand) {
    return firstPhone([
      shipping?.phone,
      customer.phone,
      payload.phone,
      billing?.phone,
      defaultAddress?.phone,
    ])
  }

  return firstPhone([
    payload.sms_marketing_phone,
    payload.phone,
    customer.phone,
    billing?.phone,
    defaultAddress?.phone,
    shipping?.phone,
  ])
}
