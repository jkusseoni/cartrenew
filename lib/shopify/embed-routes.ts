/**
 * Which paths belong to the Shopify embedded console (no Clerk).
 * Pure helpers — used by proxy.ts, providers, and tests.
 */

export function isShopifyEntryPath(pathname: string): boolean {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/shopify" ||
    pathname.startsWith("/shopify/")
  )
}

/** Session-token APIs for the embedded console. */
export function isShopifySessionApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/app") || pathname.startsWith("/api/shopify")
}

/**
 * Pingza only: paths that must never enter clerkMiddleware.
 * CartRenew (isDefault) always returns false — its middleware path is unchanged.
 */
export function isPingzaShopifyPath(pathname: string, isDefaultBrand: boolean): boolean {
  if (isDefaultBrand) return false
  return (
    isShopifyEntryPath(pathname) ||
    isShopifySessionApiPath(pathname) ||
    pathname.startsWith("/api/auth/token-exchange")
  )
}

/** Whether a synthetic / empty dashboard should keep "Finishing setup" visible. */
export function isSetupPendingDashboard(data: {
  degraded?: boolean
  store?: { id?: string } | null
}): boolean {
  return Boolean(data.degraded) || !data.store || data.store.id === "pending"
}
