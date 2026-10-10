/**
 * Shopify App Store listing for the public marketing CTA.
 * Leave this empty until a listing exists. Do not point it at /app or /shopify.
 */
export const SHOPIFY_APP_STORE_LISTING_URL = "";

/** https listing URL, or null while the constant is empty or not https. */
export function shopifyAppStoreListingHref(): string | null {
  const url = SHOPIFY_APP_STORE_LISTING_URL.trim();
  if (!url.startsWith("https://")) return null;
  return url;
}
