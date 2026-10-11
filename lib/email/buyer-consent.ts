/**
 * Shopify checkout webhooks (API 2026-07) include a top-level boolean
 * `buyer_accepts_marketing` on checkouts/create and checkouts/update.
 * carts/create and carts/update do not define that field. Only a real
 * boolean is stored, so a later cart update cannot wipe consent.
 */
export function readBuyerAcceptsMarketing(
  payload: Record<string, unknown>
): boolean | undefined {
  if (typeof payload.buyer_accepts_marketing === "boolean") {
    return payload.buyer_accepts_marketing
  }
  return undefined
}
