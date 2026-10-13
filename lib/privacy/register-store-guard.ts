import { getBearerToken } from "@/lib/shopify/verifySessionToken"

const WINDOW_MS = 10 * 60 * 1000
const LIMIT = 10

const hits = new Map<string, number[]>()

export function resetRegisterStoreRateLimitsForTests(): void {
  hits.clear()
}

export function clientIpFromForwarded(header: string | null): string {
  const first = header?.split(",")[0]?.trim()
  return first || "unknown"
}

/** True when this key is still under the limit. Records the attempt. */
export function allowRegisterAttempt(key: string, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS)
  if (recent.length >= LIMIT) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

export const REGISTER_STORE_GENERIC_ERROR = "Request could not be completed."

export type RegisterStoreDecision =
  | { ok: true; shop: string | null }
  | { ok: false; status: 401 | 429 }

/**
 * CartRenew (isDefault) skips this guard.
 * Pingza requires a Shopify session token and limits attempts per IP and shop.
 */
export async function authorizeRegisterStore(input: {
  isDefaultBrand: boolean
  authorization: string | null
  forwardedFor: string | null
  now: number
  verify: (token: string) => Promise<{ shop: string }>
}): Promise<RegisterStoreDecision> {
  if (input.isDefaultBrand) return { ok: true, shop: null }

  const ip = clientIpFromForwarded(input.forwardedFor)
  if (!allowRegisterAttempt(`ip:${ip}`, input.now)) {
    return { ok: false, status: 429 }
  }

  const token = getBearerToken(input.authorization)
  if (!token) return { ok: false, status: 401 }

  let shop: string
  try {
    shop = (await input.verify(token)).shop
  } catch {
    return { ok: false, status: 401 }
  }

  if (!allowRegisterAttempt(`shop:${shop}`, input.now)) {
    return { ok: false, status: 429 }
  }

  return { ok: true, shop }
}
