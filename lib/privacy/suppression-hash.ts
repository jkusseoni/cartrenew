import crypto from "crypto"

/** Stored in email_suppressions.email. Not a raw SHA-256 of the address. */
const PREFIX = "hmac1:"

export function isSuppressionHmac(value: string): boolean {
  return /^hmac1:[0-9a-f]{64}$/.test(value)
}

/**
 * HMAC-SHA256 of the normalized address, keyed with SUPPRESSION_HASH_SECRET.
 * Returns null when the secret is missing or the value is already hashed.
 */
export function suppressionHmac(email: string, secret: string | undefined): string | null {
  const normalized = email.trim().toLowerCase()
  const key = (secret ?? "").trim()
  if (!normalized || !key || isSuppressionHmac(normalized)) return null
  const hex = crypto.createHmac("sha256", key).update(normalized).digest("hex")
  return `${PREFIX}${hex}`
}

/** Plain address plus the HMAC form, so a send matches either row. */
export function suppressionLookupKeys(email: string, secret: string | undefined): string[] {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return []
  const keys = [normalized]
  const hashed = suppressionHmac(normalized, secret)
  if (hashed) keys.push(hashed)
  return keys
}
