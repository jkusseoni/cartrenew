export type AbandonedCartWriteRow = {
  store_id: string
  shopify_cart_token: string
  customer_phone: string | null
  customer_email: string | null
  customer_name: string | null
  cart_value: number
  items: unknown[]
  checkout_url: string | null
  updated_at: string
}

/**
 * Build an update that preserves contact and checkout data omitted by later
 * Shopify webhook payloads.
 */
export function buildAbandonedCartUpdate(
  row: AbandonedCartWriteRow
): Partial<AbandonedCartWriteRow> {
  const update: Partial<AbandonedCartWriteRow> = {
    store_id: row.store_id,
    shopify_cart_token: row.shopify_cart_token,
    cart_value: row.cart_value,
    items: row.items,
    updated_at: row.updated_at,
  }

  if (row.customer_phone !== null) update.customer_phone = row.customer_phone
  if (row.customer_email !== null) update.customer_email = row.customer_email
  if (row.customer_name !== null) update.customer_name = row.customer_name
  if (row.checkout_url !== null) update.checkout_url = row.checkout_url

  return update
}

export function shouldDispatchCartRecovery({
  canSendWhatsApp,
  cartExists,
  cartStatus,
  created,
}: {
  canSendWhatsApp: boolean
  cartExists: boolean
  cartStatus: string | null
  created: boolean
}): boolean {
  return (
    canSendWhatsApp &&
    (!cartExists || (created && cartStatus === 'pending'))
  )
}
