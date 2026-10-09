import crypto from "crypto";

/**
 * Centralized Shopify credential + crypto helpers.
 *
 * Reads the canonical env names first, falling back to the legacy names so
 * existing routes keep working regardless of which set is populated:
 *   - Client ID:     NEXT_PUBLIC_SHOPIFY_CLIENT_ID  -> SHOPIFY_API_KEY -> NEXT_PUBLIC_SHOPIFY_APP_API_KEY
 *   - Client Secret: SHOPIFY_API_SECRET -> SHOPIFY_CLIENT_SECRET (resolveShopifyApiSecret)
 *                    One secret for token exchange, token refresh, session-token
 *                    JWT verification, OAuth HMAC and webhook HMAC.
 *   - App URL:       SHOPIFY_APP_URL                -> NEXT_PUBLIC_APP_URL
 */

export const SHOPIFY_SCOPES = ["read_orders", "write_orders", "read_checkouts"] as const;

function clean(value?: string | null): string {
  return (value ?? "").replace(/['"]/g, "").trim();
}

export function getShopifyClientId(): string {
  return clean(
    process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ||
      process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID ||
      process.env.SHOPIFY_API_KEY ||
      process.env.NEXT_PUBLIC_SHOPIFY_APP_API_KEY
  );
}

export type ShopifyApiSecretSource = "SHOPIFY_API_SECRET" | "SHOPIFY_CLIENT_SECRET";

let warnedSecretMismatch = false;

/**
 * Single source of truth for the app's client secret (shpss_…), read at
 * request time in a fixed order: SHOPIFY_API_SECRET, then SHOPIFY_CLIENT_SECRET.
 * Never log the returned secret.
 */
export function resolveShopifyApiSecret(): {
  secret: string;
  source: ShopifyApiSecretSource | null;
} {
  const apiSecret = clean(process.env.SHOPIFY_API_SECRET);
  const clientSecret = clean(process.env.SHOPIFY_CLIENT_SECRET);

  if (apiSecret && clientSecret && apiSecret !== clientSecret && !warnedSecretMismatch) {
    warnedSecretMismatch = true;
    console.warn(
      "[shopify-config] SHOPIFY_API_SECRET and SHOPIFY_CLIENT_SECRET are both set but differ; using SHOPIFY_API_SECRET. Remove or fix SHOPIFY_CLIENT_SECRET."
    );
  }

  if (apiSecret) return { secret: apiSecret, source: "SHOPIFY_API_SECRET" };
  if (clientSecret) return { secret: clientSecret, source: "SHOPIFY_CLIENT_SECRET" };
  return { secret: "", source: null };
}

export function getShopifyApiSecret(): string {
  return resolveShopifyApiSecret().secret;
}

/** Alias of getShopifyApiSecret. */
export function getShopifyClientSecret(): string {
  return getShopifyApiSecret();
}

/**
 * Secret Shopify uses to sign webhook HMAC (X-Shopify-Hmac-SHA256).
 * Alias of getShopifyApiSecret — do not use SHOPIFY_WEBHOOK_SECRET.
 */
export function getShopifyWebhookSecret(): string {
  return getShopifyApiSecret();
}

/** Which env key supplied the secret (never logs the value). */
export function getShopifyWebhookSecretSource(): ShopifyApiSecretSource | null {
  return resolveShopifyApiSecret().source;
}

/** @deprecated Use getShopifyWebhookSecretSource for webhook HMAC diagnostics. */
export function getShopifyClientSecretSource(): ShopifyApiSecretSource | null {
  return getShopifyWebhookSecretSource();
}

export function getShopifyAppUrl(): string {
  return clean(process.env.SHOPIFY_APP_URL || process.env.NEXT_PUBLIC_APP_URL).replace(/\/$/, "");
}

export function getShopifyApiVersion(): string {
  return clean(process.env.SHOPIFY_API_VERSION) || "2024-10";
}

export function getShopifyScopes(): string {
  return SHOPIFY_SCOPES.join(",");
}

/** Guard against open-redirect / SSRF: only accept genuine *.myshopify.com hosts. */
export function isValidShopDomain(shop: string | null | undefined): shop is string {
  if (!shop) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

/**
 * Verify the OAuth redirect HMAC (hex digest over the sorted query string,
 * excluding `hmac` and `signature`).
 */
export function verifyOAuthHmac(
  query: URLSearchParams,
  secret: string = getShopifyApiSecret()
): boolean {
  const hmac = query.get("hmac") || "";
  if (!secret || !hmac) return false;

  const filtered = new URLSearchParams(
    Array.from(query.entries()).filter(([key]) => key !== "hmac" && key !== "signature")
  );
  filtered.sort();

  const generated = crypto
    .createHmac("sha256", secret)
    .update(filtered.toString())
    .digest("hex");

  return timingSafeEqual(generated, hmac, "hex");
}

export type WebhookHmacVerifyResult = {
  ok: boolean;
  reason?:
    | "missing_secret"
    | "missing_hmac_header"
    | "hmac_mismatch";
  secretSource?: string | null;
};

/**
 * Verify an incoming webhook payload against the `X-Shopify-Hmac-SHA256`
 * header (base64 digest over the raw request body), using SHOPIFY_API_SECRET.
 */
export function verifyWebhookHmacDetailed(
  rawBody: string,
  hmacHeader: string | null | undefined,
  secret: string = getShopifyWebhookSecret()
): WebhookHmacVerifyResult {
  const secretSource = getShopifyWebhookSecretSource();
  const normalizedHmac = clean(hmacHeader);

  if (!secret) {
    return { ok: false, reason: "missing_secret", secretSource };
  }
  if (!normalizedHmac) {
    return { ok: false, reason: "missing_hmac_header", secretSource };
  }

  const generated = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  if (!timingSafeEqual(generated, normalizedHmac, "base64")) {
    return { ok: false, reason: "hmac_mismatch", secretSource };
  }

  return { ok: true, secretSource };
}

/**
 * Verify an incoming webhook payload against the `X-Shopify-Hmac-SHA256`
 * header (base64 digest over the raw request body).
 */
export function verifyWebhookHmac(
  rawBody: string,
  hmacHeader: string | null | undefined,
  secret: string = getShopifyWebhookSecret()
): boolean {
  return verifyWebhookHmacDetailed(rawBody, hmacHeader, secret).ok;
}

export function hasShopifyClientSecret(): boolean {
  return getShopifyApiSecret().length > 0;
}

function timingSafeEqual(a: string, b: string, encoding: "hex" | "base64"): boolean {
  try {
    const bufA = Buffer.from(a, encoding);
    const bufB = Buffer.from(b, encoding);
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
