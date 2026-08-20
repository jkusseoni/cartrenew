import assert from "node:assert/strict";

import { SignJWT } from "jose";

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

    console.log("Shopify session-token credential alias tests passed.");
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
