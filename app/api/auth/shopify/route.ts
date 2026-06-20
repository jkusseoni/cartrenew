export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  getShopifyAppUrl,
  getShopifyClientId,
  getShopifyScopes,
  isValidShopDomain,
} from "@/lib/shopify/config";

const STATE_COOKIE = "shopify_oauth_state";

/**
 * GET /api/auth/shopify?shop=my-store.myshopify.com[&state=...]
 *
 * Initiates the Shopify OAuth handshake by redirecting the merchant to Shopify's
 * authorization screen, requesting an offline (permanent) access token with the
 * order/checkout scopes the cart-recovery engine needs.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shop = url.searchParams.get("shop");

  if (!isValidShopDomain(shop)) {
    return NextResponse.json(
      { error: "Missing or invalid 'shop' parameter (expected my-store.myshopify.com)" },
      { status: 400 }
    );
  }

  const clientId = getShopifyClientId();
  const appUrl = getShopifyAppUrl();

  if (!clientId || !appUrl) {
    return NextResponse.json(
      { error: "Shopify app is not configured (missing client id or app url)." },
      { status: 500 }
    );
  }

  // Carry the Clerk user id through `state` when available, plus a CSRF nonce.
  const nonce = crypto.randomBytes(16).toString("hex");
  const passedState = url.searchParams.get("state");
  const state = passedState ? `${passedState}.${nonce}` : nonce;

  const redirectUri = `${appUrl}/api/auth/shopify/callback`;

  const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("scope", getShopifyScopes());
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  // Omitting grant_options[] requests an offline (permanent) access token.

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
