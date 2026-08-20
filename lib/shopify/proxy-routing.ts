/** Routes authenticated with Shopify session tokens instead of Clerk. */
export function isShopifyEntry(pathname: string): boolean {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/shopify" ||
    pathname.startsWith("/shopify/")
  );
}

export function isShopifyApi(pathname: string): boolean {
  return pathname.startsWith("/api/app");
}

/**
 * Clerk may only be bypassed for routes that perform their own Shopify auth.
 * Query parameters are attacker-controlled and must never make other pages public.
 */
export function shouldBypassAuthForShopify(pathname: string): boolean {
  return isShopifyEntry(pathname) || isShopifyApi(pathname);
}
