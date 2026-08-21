import assert from "node:assert/strict";
import test from "node:test";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

import { POST as subscribe } from "../app/api/shopify/billing/subscribe/route";
import { resolveBillingPlanFromActiveSubscription } from "../lib/shopify/billing";

test("rejects unauthenticated legacy subscription requests before billing", async () => {
  const request = new NextRequest(
    "http://localhost/api/shopify/billing/subscribe",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop: "victim.myshopify.com",
        planId: "scale",
      }),
    }
  );

  const response = await subscribe(request);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("rejects a valid shop token used to bill another tenant", async () => {
  const previousKey = process.env.SHOPIFY_API_KEY;
  const previousSecret = process.env.SHOPIFY_API_SECRET;
  const apiKey = "test-api-key";
  const apiSecret = "test-api-secret";

  process.env.SHOPIFY_API_KEY = apiKey;
  process.env.SHOPIFY_API_SECRET = apiSecret;

  try {
    const token = await new SignJWT({
      aud: apiKey,
      dest: "https://attacker.myshopify.com",
      iss: "https://attacker.myshopify.com/admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(apiSecret));

    const request = new NextRequest(
      "http://localhost/api/shopify/billing/subscribe",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop: "victim.myshopify.com",
          planId: "scale",
        }),
      }
    );

    const response = await subscribe(request);

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Forbidden" });
  } finally {
    if (previousKey === undefined) delete process.env.SHOPIFY_API_KEY;
    else process.env.SHOPIFY_API_KEY = previousKey;

    if (previousSecret === undefined) delete process.env.SHOPIFY_API_SECRET;
    else process.env.SHOPIFY_API_SECRET = previousSecret;
  }
});

test("derives billing entitlements from Shopify's active subscription name", () => {
  assert.equal(
    resolveBillingPlanFromActiveSubscription("CartRenew Starter", "scale"),
    "starter"
  );
  assert.equal(
    resolveBillingPlanFromActiveSubscription("CartRenew Scale", "starter"),
    "scale"
  );
});

test("keeps the stored plan when Shopify returns an unknown subscription name", () => {
  assert.equal(
    resolveBillingPlanFromActiveSubscription("Legacy CartRenew Plan", "growth"),
    "growth"
  );
  assert.equal(resolveBillingPlanFromActiveSubscription(null, null), null);
});
