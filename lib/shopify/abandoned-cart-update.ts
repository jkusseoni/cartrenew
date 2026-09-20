const OPTIONAL_CART_FIELDS = [
  'customer_phone',
  'customer_email',
  'customer_name',
  'checkout_url',
] as const

/**
 * Shopify update webhooks can omit contact and checkout fields that were
 * present in an earlier payload. Omit those missing values from database
 * updates so partial webhooks do not erase usable recovery data.
 */
export function preserveExistingCartFields<T extends Record<string, unknown>>(
  row: T
): Partial<T> {
  const update: Partial<T> = { ...row }

  for (const field of OPTIONAL_CART_FIELDS) {
    if (update[field] === null || update[field] === undefined || update[field] === '') {
      delete update[field]
    }
  }

  return update
}
