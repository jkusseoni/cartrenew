const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SLUG_RE = /^[a-zA-Z0-9_-]{1,128}$/

export function isRecoveryCartUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

/** UUID or Shopify cart/checkout token slug used in /r/{cartId}. */
export function isValidRecoveryCartSlug(value: string): boolean {
  const trimmed = value.trim()
  return isRecoveryCartUuid(trimmed) || SLUG_RE.test(trimmed)
}

export function getAppBaseUrl(): string {
  const configured =
    process.env.SHOPIFY_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000'

  return configured.replace(/\/$/, '')
}

/** Public tracked link embedded in WhatsApp recovery messages. */
export function getTrackedRecoveryUrl(cartId: string): string {
  return `${getAppBaseUrl()}/r/${cartId}`
}
