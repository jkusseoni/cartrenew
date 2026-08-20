import { jwtVerify, type JWTPayload } from "jose";

import {
  getShopifyClientId,
  getShopifyClientSecret,
  isValidShopDomain,
} from "@/lib/shopify/config";

export type ShopifySessionTokenPayload = JWTPayload & {
  iss?: string;
  dest?: string;
  aud?: string | string[];
  sub?: string;
  sid?: string;
};

export type VerifiedShopifySession = {
  shop: string;
  sessionTokenPayload: ShopifySessionTokenPayload;
};

function extractShopFromDest(dest: string | undefined): string {
  if (!dest) {
    throw new Error("Session token missing dest claim");
  }

  let hostname: string;
  try {
    hostname = new URL(dest).hostname;
  } catch {
    hostname = dest.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  }

  if (!isValidShopDomain(hostname)) {
    throw new Error(`Session token dest is not a valid *.myshopify.com URL: ${dest}`);
  }

  return hostname;
}

function audienceMatches(aud: string | string[] | undefined, apiKey: string): boolean {
  if (!aud) return false;
  if (Array.isArray(aud)) return aud.includes(apiKey);
  return aud === apiKey;
}

/**
 * Verify a Shopify App Bridge session token (HS256) with jose.
 * Validates aud === Shopify client ID, exp/nbf, and dest as *.myshopify.com.
 *
 * Credential resolution uses the same canonical and legacy environment aliases
 * as OAuth, webhooks, and App Bridge.
 */
export async function verifySessionToken(token: string): Promise<VerifiedShopifySession> {
  if (!token || typeof token !== "string") {
    throw new Error("Missing session token");
  }

  const apiKey = getShopifyClientId();
  const apiSecret = getShopifyClientSecret();

  if (!apiKey) {
    throw new Error("Shopify client ID is not configured");
  }
  if (!apiSecret) {
    throw new Error("Shopify client secret is not configured");
  }

  const key = new TextEncoder().encode(apiSecret);

  let payload: ShopifySessionTokenPayload;
  try {
    const verified = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    payload = verified.payload as ShopifySessionTokenPayload;
  } catch {
    throw new Error("Invalid session token");
  }

  if (!audienceMatches(payload.aud, apiKey)) {
    throw new Error("Invalid session token");
  }

  const shop = extractShopFromDest(payload.dest);

  return { shop, sessionTokenPayload: payload };
}

/** Extract Bearer token from an Authorization header value. */
export function getBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Read Authorization: Bearer <sessionToken> from a Request and verify it.
 * Throws on missing/invalid tokens.
 */
export async function verifySessionTokenFromRequest(
  request: Request
): Promise<VerifiedShopifySession> {
  const token = getBearerToken(request.headers.get("authorization"));
  if (!token) {
    throw new Error("Missing Authorization Bearer session token");
  }
  return verifySessionToken(token);
}
