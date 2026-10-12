/** Last 6 characters of a checkout or cart token. Never the full value. */
export function tokenSuffix(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = value.trim()
  if (!text) return null
  return text.slice(-6)
}

/** Origin and path only. Query strings (including recovery ?key=) are dropped. */
export function checkoutUrlForLog(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    const parsed = new URL(value)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return "invalid-url"
  }
}

export function maskEmailForLog(value: unknown): string | null {
  if (typeof value !== "string") return null
  const email = value.trim()
  if (!email) return null
  const at = email.indexOf("@")
  if (at <= 0) return "present"
  return `${email.slice(0, 1)}***@${email.slice(at + 1)}`
}

export function shopifyCheckoutLog(input: {
  topic: string
  shop: string
  checkoutToken: unknown
  lineItemCount: number
  hasEmail: boolean
  hasPhone: boolean
}) {
  return {
    topic: input.topic,
    shop: input.shop,
    checkoutTokenSuffix: tokenSuffix(input.checkoutToken),
    lineItemCount: input.lineItemCount,
    hasEmail: input.hasEmail,
    hasPhone: input.hasPhone,
  }
}
