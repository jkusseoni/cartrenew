import assert from "node:assert/strict";

import { SignJWT } from "jose";
import { NextRequest } from "next/server";

import { POST as subscribeToLegacyBilling } from "../app/api/shopify/billing/subscribe/route";
import { GET as startShopifyOAuth } from "../app/api/auth/shopify/route";
import { GET as finishShopifyOAuth } from "../app/api/auth/shopify/callback/route";
import { GET as finishLegacyShopifyOAuth } from "../app/api/shopify/callback/route";
import { verifySessionToken } from "../lib/shopify/verifySessionToken";

const SHOP = "session-test.myshopify.com";
const CLIENT_ID = "session-test-client-id";
const CLIENT_SECRET = "session-test-client-secret";
const CREDENTIAL_KEYS = [
  "NEXT_PUBLIC_SHOPIFY_API_KEY",
  "NEXT_PUBLIC_SHOPIFY_CLIENT_ID",
  "SHOPIFY_API_KEY",
  "NEXT_PUBLIC_SHOPIFY_APP_API_KEY",
  "SHOPIFY_CLIENT_SECRET",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_API_SECRET",
  "SHOPIFY_APP_URL",
] as const;

const originalEnvironment = Object.fromEntries(
  CREDENTIAL_KEYS.map((key) => [key, process.env[key]])
);

async function createSessionToken(audience = CLIENT_ID) {
  return new SignJWT({ dest: `https://${SHOP}` })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(CLIENT_SECRET));
}

function clearCredentials() {
  for (const key of CREDENTIAL_KEYS) {
    delete process.env[key];
  }
}

async function main() {
  try {
    const token = await createSessionToken();

    clearCredentials();
    process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID = CLIENT_ID;
    process.env.SHOPIFY_CLIENT_SECRET = CLIENT_SECRET;

    const canonicalResult = await verifySessionToken(token);
    assert.equal(canonicalResult.shop, SHOP);

    clearCredentials();
    process.env.SHOPIFY_API_KEY = CLIENT_ID;
    process.env.SHOPIFY_API_SECRET = CLIENT_SECRET;

    const legacyResult = await verifySessionToken(token);
    assert.equal(legacyResult.shop, SHOP);

    const wrongAudienceToken = await createSessionToken("another-client-id");
    await assert.rejects(verifySessionToken(wrongAudienceToken), /Invalid session token/);

    clearCredentials();
    const unauthenticatedBillingResponse = await subscribeToLegacyBilling(
      new NextRequest("https://www.cartrenew.com/api/shopify/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({ shop: SHOP, planId: "starter" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    assert.equal(unauthenticatedBillingResponse.status, 401);

    process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID = CLIENT_ID;
    process.env.SHOPIFY_CLIENT_SECRET = CLIENT_SECRET;
    const crossShopBillingResponse = await subscribeToLegacyBilling(
      new NextRequest("https://www.cartrenew.com/api/shopify/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({
          shop: "another-store.myshopify.com",
          planId: "starter",
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
    );
    assert.equal(crossShopBillingResponse.status, 403);

    process.env.SHOPIFY_APP_URL = "https://www.cartrenew.com";
    const oauthStartResponse = await startShopifyOAuth(
      new NextRequest(
        `https://www.cartrenew.com/api/auth/shopify?shop=${SHOP}&state=attacker-user`
      )
    );
    assert.equal(oauthStartResponse.status, 307);
    const oauthLocation = oauthStartResponse.headers.get("location");
    assert.ok(oauthLocation);
    const oauthState = new URL(oauthLocation).searchParams.get("state");
    const stateCookie = oauthStartResponse.cookies.get("shopify_oauth_state")?.value;
    assert.ok(oauthState);
    assert.equal(oauthState, stateCookie);
    assert.doesNotMatch(oauthState, /attacker-user/);

    const missingStateResponse = await finishShopifyOAuth(
      new NextRequest(
        `https://www.cartrenew.com/api/auth/shopify/callback?shop=${SHOP}&code=test-code`
      )
    );
    assert.equal(missingStateResponse.status, 401);

    const legacyCallbackResponse = await finishLegacyShopifyOAuth(
      new NextRequest(
        `https://www.cartrenew.com/api/shopify/callback?shop=${SHOP}&code=test-code&state=attacker-user`
      )
    );
    assert.equal(legacyCallbackResponse.status, 410);

    console.log("Shopify session-token, billing, and OAuth authorization tests passed.");
  } finally {
    clearCredentials();
    for (const key of CREDENTIAL_KEYS) {
      const value = originalEnvironment[key];
      if (value !== undefined) {
        process.env[key] = value;
      }
    }
  }
}

void main();
