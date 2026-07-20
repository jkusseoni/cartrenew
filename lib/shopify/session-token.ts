import crypto from "crypto";

import {
  getShopifyClientId,
  getShopifyClientSecret,
  isValidShopDomain,
} from "@/lib/shopify/config";

type ShopifySessionPayload = {
  iss?: string;
  dest?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  nbf?: number;
};

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function parsePayload(token: string): ShopifySessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    return JSON.parse(base64UrlDecode(parts[1])) as ShopifySessionPayload;
  } catch {
    return null;
  }
}

function verifyHs256Signature(token: string, secret: string): boolean {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  try {
    const actualBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

function extractShopDomain(dest: string | undefined): string | null {
  if (!dest) return null;

  try {
    const hostname = new URL(dest).hostname;
    return isValidShopDomain(hostname) ? hostname : null;
  } catch {
    return isValidShopDomain(dest) ? dest : null;
  }
}

function audienceMatches(aud: string | string[] | undefined, clientId: string): boolean {
  if (!aud) return false;
  if (Array.isArray(aud)) return aud.includes(clientId);
  return aud === clientId;
}

export function verifyShopifySessionToken(token: string): { shop: string } | null {
  const secret = getShopifyClientSecret();
  const clientId = getShopifyClientId();
  if (!secret || !clientId) return null;

  const payload = parsePayload(token);
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) return null;
  if (typeof payload.nbf === "number" && payload.nbf > now) return null;
  if (!audienceMatches(payload.aud, clientId)) return null;

  const shop = extractShopDomain(payload.dest);
  if (!shop) return null;

  if (payload.iss) {
    try {
      const issHost = new URL(payload.iss).hostname;
      const destHost = new URL(payload.dest ?? "").hostname;
      if (issHost !== destHost) return null;
    } catch {
      return null;
    }
  }

  if (!verifyHs256Signature(token, secret)) return null;

  return { shop };
}

export function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}
