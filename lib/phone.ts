/**
 * Phone normalization to E.164 without guessing a country.
 *
 * A number is only accepted when its country is known: an explicit "+"/"00"
 * international prefix, a caller-supplied calling code (e.g. derived from the
 * WooCommerce billing country), or 11–15 bare digits that already carry a
 * country code (how earlier plugin versions and Shopify stored numbers).
 * Short national numbers without a calling code are rejected as
 * `country_unknown` instead of being prefixed with a default country.
 */

export type PhoneNormalizationFailure = 'missing' | 'invalid' | 'country_unknown'

export type PhoneNormalizationResult =
  | { ok: true; e164: string }
  | { ok: false; reason: PhoneNormalizationFailure }

const MIN_E164_DIGITS = 8
const MAX_E164_DIGITS = 15

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function toE164(
  raw: string | null | undefined,
  options: { callingCode?: string | number | null } = {}
): PhoneNormalizationResult {
  let input = (raw ?? '').trim()
  if (input.toLowerCase().startsWith('whatsapp:')) {
    input = input.slice('whatsapp:'.length).trim()
  }

  const digits = digitsOnly(input)
  if (!digits) return { ok: false, reason: 'missing' }

  const callingCode = digitsOnly(String(options.callingCode ?? ''))
  let international: string

  if (input.startsWith('+')) {
    international = digits
  } else if (digits.startsWith('00')) {
    international = digits.slice(2)
  } else if (callingCode) {
    const national = digits.replace(/^0+/, '')
    // 11+ digits starting with the calling code means the shopper already
    // typed it (e.g. "919876543210"); shorter numbers are national.
    international =
      national.startsWith(callingCode) && national.length >= 11
        ? national
        : `${callingCode}${national}`
  } else if (digits.startsWith('0') || digits.length <= 10) {
    return { ok: false, reason: 'country_unknown' }
  } else {
    international = digits
  }

  if (
    international.length < MIN_E164_DIGITS ||
    international.length > MAX_E164_DIGITS ||
    international.startsWith('0')
  ) {
    return { ok: false, reason: 'invalid' }
  }

  return { ok: true, e164: `+${international}` }
}

/** Meta's Graph API `to` field: E.164 digits without the "+". */
export function e164ToWhatsAppRecipient(e164: string): string {
  return digitsOnly(e164)
}

/** Mask all but the last 4 digits for logs. */
export function maskPhone(phone: string | null | undefined): string {
  const digits = digitsOnly(phone ?? '')
  if (!digits) return '(none)'
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
}
