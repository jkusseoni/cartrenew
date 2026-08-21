import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as beginOAuth } from "../app/api/auth/shopify/route";
import { GET as finishOAuth } from "../app/api/auth/shopify/callback/route";
import { GET as legacyCallback } from "../app/api/shopify/callback/route";

test("OAuth initiation ignores caller-controlled identity in state", async () => {
  const previousClientId = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const previousAppUrl = process.env.SHOPIFY_APP_URL;

  process.env.NEXT_PUBLIC_SHOPIFY_API_KEY = "test-client-id";
  process.env.SHOPIFY_APP_URL = "https://app.example.com";

  try {
    const request = new NextRequest(
      "https://app.example.com/api/auth/shopify" +
        "?shop=example.myshopify.com&state=attacker_user"
    );

    const response = await beginOAuth(request);
    const location = response.headers.get("location");
    assert.ok(location);

    const state = new URL(location).searchParams.get("state");
    assert.match(state ?? "", /^[a-f0-9]{32}$/);
    assert.equal(state?.includes("attacker_user"), false);
    assert.match(response.headers.get("set-cookie") ?? "", /shopify_oauth_state=/);
  } finally {
    if (previousClientId === undefined) {
      delete process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
    } else {
      process.env.NEXT_PUBLIC_SHOPIFY_API_KEY = previousClientId;
    }

    if (previousAppUrl === undefined) delete process.env.SHOPIFY_APP_URL;
    else process.env.SHOPIFY_APP_URL = previousAppUrl;
  }
});

test("OAuth callback rejects requests without the initiating state cookie", async () => {
  const request = new NextRequest(
    "https://app.example.com/api/auth/shopify/callback" +
      "?shop=example.myshopify.com&code=test&state=attacker&hmac=test"
  );

  const response = await finishOAuth(request);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "OAuth state mismatch" });
});

test("legacy unbound OAuth callback remains closed", async () => {
  const response = await legacyCallback();

  assert.equal(response.status, 410);
});
