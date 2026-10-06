import {
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/core'
import metadata from 'libphonenumber-js/metadata.min.json'

import { toE164 } from '@/lib/phone'

export type ShopifyPhoneSource =
  | 'shipping_address.phone'
  | 'customer.phone'
  | 'payload.phone'
  | 'billing_address.phone'
  | 'customer.default_address.phone'

type ShopifyRecord = Record<string, unknown>

function asRecord(value: unknown): ShopifyRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ShopifyRecord)
    : undefined
}

function countryForSource(
  source: ShopifyPhoneSource,
  payload: ShopifyRecord,
  customer: ShopifyRecord
): CountryCode | null {
  let value: unknown

  if (source === 'shipping_address.phone') {
    value = asRecord(payload.shipping_address)?.country_code
  } else if (source === 'billing_address.phone') {
    value = asRecord(payload.billing_address)?.country_code
  } else if (source === 'customer.default_address.phone') {
    value = asRecord(customer.default_address)?.country_code
  } else {
    // Top-level and customer phones do not have an address-local country.
    // Borrowing shipping/billing context here could silently target a different country.
    return null
  }

  if (typeof value !== 'string') return null
  const country = value.trim().toUpperCase()
  return isSupportedCountry(country as CountryCode, metadata) ? (country as CountryCode) : null
}

/**
 * Normalize a Shopify phone using only the country attached to that phone's
 * address object. Country-less national numbers remain unchanged and are
 * rejected later as `country_unknown`; no store-wide default is applied.
 */
export function normalizeShopifyPhoneForSource(
  rawPhone: string,
  source: ShopifyPhoneSource,
  payload: ShopifyRecord,
  customer: ShopifyRecord
): string {
  const direct = toE164(rawPhone)
  if (direct.ok) return direct.e164
  if (direct.reason !== 'country_unknown') return rawPhone

  const country = countryForSource(source, payload, customer)
  if (!country) return rawPhone

  const parsed = parsePhoneNumberFromString(rawPhone, country, metadata)
  return parsed?.isValid() ? parsed.number : rawPhone
}
