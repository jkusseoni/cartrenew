import { supabaseAdmin } from "@/lib/supabase";
import {
  getShopifyClientId,
  getShopifyClientSecret,
} from "@/lib/shopify/config";

/**
 * Expiring offline access tokens (Shopify Admin API).
 * Docs: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens
 *
 * Tokens and refresh tokens are server-only: never return them from an API
 * route and never log them.
 */

/** Refresh when less than this much lifetime is left. */
export const ACCESS_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

const REFRESH_LOCK_LEASE_MS = 30_000;
const REFRESH_LOCK_WAIT_MS = 8_000;
const REFRESH_LOCK_POLL_MS = 250;

export type ShopifyTokenGrant = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string | null;
};

export type StoreTokenRow = {
  id: string;
  shopify_domain: string | null;
  shopify_access_token: string | null;
  shopify_access_token_expires_at: string | null;
  shopify_refresh_token: string | null;
  shopify_refresh_token_expires_at: string | null;
};

export type ValidShopifyAccessToken =
  | { ok: true; shop: string; accessToken: string; refreshed: boolean }
  | {
      ok: false;
      reason:
        | "not_installed"
        | "needs_token_exchange"
        | "refresh_failed"
        | "busy"
        | "unavailable";
    };

type TokenFailureReason = Extract<ValidShopifyAccessToken, { ok: false }>["reason"];

const STORE_TOKEN_COLUMNS =
  "id, shopify_domain, shopify_access_token, shopify_access_token_expires_at, shopify_refresh_token, shopify_refresh_token_expires_at";

export const CLEARED_SHOPIFY_TOKEN_COLUMNS = {
  shopify_access_token: null,
  shopify_access_token_expires_at: null,
  shopify_refresh_token: null,
  shopify_refresh_token_expires_at: null,
  shopify_token_refresh_locked_until: null,
} as const;

/** Parse a token-endpoint response; null unless it is an expiring offline token. */
export function parseExpiringTokenResponse(
  body: unknown,
  now: number = Date.now()
): ShopifyTokenGrant | null {
  if (!body || typeof body !== "object") return null;
  const json = body as Record<string, unknown>;

  const accessToken = json.access_token;
  const refreshToken = json.refresh_token;
  const expiresIn = Number(json.expires_in);
  const refreshExpiresIn = Number(json.refresh_token_expires_in);

  if (typeof accessToken !== "string" || !accessToken) return null;
  if (typeof refreshToken !== "string" || !refreshToken) return null;
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) return null;

  return {
    accessToken,
    accessTokenExpiresAt: new Date(now + expiresIn * 1000).toISOString(),
    refreshToken,
    refreshTokenExpiresAt:
      Number.isFinite(refreshExpiresIn) && refreshExpiresIn > 0
        ? new Date(now + refreshExpiresIn * 1000).toISOString()
        : null,
  };
}

/** Columns to write for a freshly issued token pair (also releases the refresh lock). */
export function tokenGrantColumns(grant: ShopifyTokenGrant) {
  return {
    shopify_access_token: grant.accessToken,
    shopify_access_token_expires_at: grant.accessTokenExpiresAt,
    shopify_refresh_token: grant.refreshToken,
    shopify_refresh_token_expires_at: grant.refreshTokenExpiresAt,
    shopify_token_refresh_locked_until: null,
  };
}

type TokenState =
  | { state: "valid"; accessToken: string }
  | { state: "refresh" }
  | { state: "unusable"; reason: TokenFailureReason };

function classifyToken(row: StoreTokenRow | null, now: number = Date.now()): TokenState {
  if (!row?.shopify_access_token || !row.shopify_domain) {
    return { state: "unusable", reason: "not_installed" };
  }
  // Legacy non-expiring token: the Admin API rejects these for public apps.
  if (!row.shopify_access_token_expires_at) {
    return { state: "unusable", reason: "needs_token_exchange" };
  }
  if (Date.parse(row.shopify_access_token_expires_at) - now > ACCESS_TOKEN_REFRESH_BUFFER_MS) {
    return { state: "valid", accessToken: row.shopify_access_token };
  }
  const refreshUsable =
    Boolean(row.shopify_refresh_token) &&
    (!row.shopify_refresh_token_expires_at ||
      Date.parse(row.shopify_refresh_token_expires_at) > now);
  return refreshUsable ? { state: "refresh" } : { state: "unusable", reason: "needs_token_exchange" };
}

/**
 * True when the store has an expiring token the Admin API accepts now or after a
 * refresh. Legacy non-expiring tokens and dead refresh tokens count as not connected.
 */
export function hasUsableShopifyToken(row: StoreTokenRow | null, now: number = Date.now()): boolean {
  return classifyToken(row, now).state !== "unusable";
}

async function loadStoreTokenRow(storeId: string): Promise<StoreTokenRow | null> {
  const { data, error } = await supabaseAdmin
    .from("stores")
    .select(STORE_TOKEN_COLUMNS)
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw new Error(`store token lookup failed: ${error.message}`);
  return (data as StoreTokenRow | null) ?? null;
}

function toResult(row: StoreTokenRow, state: TokenState, refreshed: boolean): ValidShopifyAccessToken {
  if (state.state === "valid") {
    return { ok: true, shop: row.shopify_domain as string, accessToken: state.accessToken, refreshed };
  }
  return { ok: false, reason: state.state === "unusable" ? state.reason : "busy" };
}

async function acquireRefreshLock(storeId: string): Promise<string | null> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + REFRESH_LOCK_LEASE_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("stores")
    .update({ shopify_token_refresh_locked_until: lockedUntil })
    .eq("id", storeId)
    .or(
      `shopify_token_refresh_locked_until.is.null,shopify_token_refresh_locked_until.lt.${now.toISOString()}`
    )
    .select("id");
  if (error) throw new Error(`refresh lock failed: ${error.message}`);
  return Array.isArray(data) && data.length > 0 ? lockedUntil : null;
}

async function releaseRefreshLock(storeId: string, lockedUntil: string) {
  await supabaseAdmin
    .from("stores")
    .update({ shopify_token_refresh_locked_until: null })
    .eq("id", storeId)
    .eq("shopify_token_refresh_locked_until", lockedUntil);
}

/** Another request holds the lock — wait for it to store the rotated token. */
async function waitForConcurrentRefresh(storeId: string): Promise<ValidShopifyAccessToken> {
  const deadline = Date.now() + REFRESH_LOCK_WAIT_MS;
  let row: StoreTokenRow | null = null;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, REFRESH_LOCK_POLL_MS));
    row = await loadStoreTokenRow(storeId);
    const state = classifyToken(row);
    if (state.state !== "refresh" && row) return toResult(row, state, false);
    if (!row) return { ok: false, reason: "not_installed" };
  }
  // Still inside the refresh buffer but not yet expired: safe to use for this request.
  if (
    row?.shopify_access_token &&
    row.shopify_domain &&
    row.shopify_access_token_expires_at &&
    Date.parse(row.shopify_access_token_expires_at) > Date.now()
  ) {
    return { ok: true, shop: row.shopify_domain, accessToken: row.shopify_access_token, refreshed: false };
  }
  return { ok: false, reason: "busy" };
}

async function refreshLockedStoreToken(row: StoreTokenRow): Promise<ValidShopifyAccessToken> {
  const shop = row.shopify_domain as string;
  const presentedRefreshToken = row.shopify_refresh_token as string;
  const clientId = getShopifyClientId();
  const clientSecret = getShopifyClientSecret();
  if (!clientId || !clientSecret) {
    console.error("[shopify-token] Shopify app credentials are not configured");
    return { ok: false, reason: "unavailable" };
  }

  let res: Response;
  try {
    res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: presentedRefreshToken,
      }),
    });
  } catch (error) {
    console.warn(
      "[shopify-token] refresh request failed (retryable):",
      row.id,
      error instanceof Error ? error.message : error
    );
    return { ok: false, reason: "unavailable" };
  }

  // 401 invalid_request is Shopify's only terminal refresh error (expired,
  // replaced, revoked or uninstalled). Anything else may be config or transient,
  // so keep the refresh token for a later retry.
  if (res.status === 401) {
    console.warn("[shopify-token] refresh token rejected; store needs token exchange:", row.id);
    await supabaseAdmin
      .from("stores")
      .update(CLEARED_SHOPIFY_TOKEN_COLUMNS)
      .eq("id", row.id)
      .eq("shopify_refresh_token", presentedRefreshToken);
    return { ok: false, reason: "refresh_failed" };
  }
  if (!res.ok) {
    console.error("[shopify-token] refresh failed:", row.id, "HTTP", res.status);
    return { ok: false, reason: "unavailable" };
  }

  const grant = parseExpiringTokenResponse(await res.json().catch(() => null));
  if (!grant) {
    console.error("[shopify-token] refresh response missing expiring token fields:", row.id);
    return { ok: false, reason: "unavailable" };
  }

  // Compare-and-set: a token exchange may have replaced the pair meanwhile, in
  // which case its tokens win and this refresh result is discarded.
  const { data: saved, error } = await supabaseAdmin
    .from("stores")
    .update(tokenGrantColumns(grant))
    .eq("id", row.id)
    .eq("shopify_refresh_token", presentedRefreshToken)
    .select("id");
  if (error) {
    console.error("[shopify-token] failed to save refreshed token:", row.id, error.message);
    return { ok: false, reason: "unavailable" };
  }
  if (Array.isArray(saved) && saved.length > 0) {
    return { ok: true, shop, accessToken: grant.accessToken, refreshed: true };
  }

  const current = await loadStoreTokenRow(row.id);
  return current ? toResult(current, classifyToken(current), false) : { ok: false, reason: "not_installed" };
}

/**
 * Admin API access token for a store, refreshed when it has under 5 minutes left.
 * Only one request refreshes a store at a time (lease column + compare-and-set);
 * concurrent callers wait for the rotated token instead of refreshing again.
 */
export async function getValidShopifyAccessToken(storeId: string): Promise<ValidShopifyAccessToken> {
  try {
    const row = await loadStoreTokenRow(storeId);
    const state = classifyToken(row);
    if (!row) return { ok: false, reason: "not_installed" };
    if (state.state !== "refresh") return toResult(row, state, false);

    const lockedUntil = await acquireRefreshLock(storeId);
    if (!lockedUntil) return await waitForConcurrentRefresh(storeId);

    try {
      // Re-read under the lock: another request may have refreshed already.
      const lockedRow = await loadStoreTokenRow(storeId);
      const lockedState = classifyToken(lockedRow);
      if (!lockedRow) return { ok: false, reason: "not_installed" };
      if (lockedState.state !== "refresh") return toResult(lockedRow, lockedState, false);
      return await refreshLockedStoreToken(lockedRow);
    } finally {
      await releaseRefreshLock(storeId, lockedUntil).catch(() => undefined);
    }
  } catch (error) {
    console.error(
      "[shopify-token] could not resolve access token:",
      storeId,
      error instanceof Error ? error.message : error
    );
    return { ok: false, reason: "unavailable" };
  }
}
