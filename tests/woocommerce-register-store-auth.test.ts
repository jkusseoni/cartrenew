import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";

import {
  buildWooCommerceStoreRegistration,
  POST,
} from "../app/api/woocommerce/register-store/route";

const originalNodeEnv = process.env.NODE_ENV;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.NODE_ENV = "production";
});

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
  globalThis.fetch = originalFetch;
});

test("rejects anonymous credential issuance before any database request", async () => {
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Supabase must not be contacted");
  };

  const response = await POST(
    new NextRequest("https://cartrenew.example/api/woocommerce/register-store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "attacker@example.com",
        site_url: "https://victim-store.example",
      }),
    })
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
  assert.equal(fetchCalls, 0);
});

test("binds new WooCommerce credentials to the authenticated Clerk user", () => {
  const registration = buildWooCommerceStoreRegistration({
    apiKey: "test-api-key",
    email: "owner@example.com",
    siteUrl: "https://owner-store.example",
    storeName: "Owner Store",
    userId: "user_owner",
  });

  assert.equal(registration.clerk_user_id, "user_owner");
  assert.equal(registration.site_url, "https://owner-store.example");
  assert.equal(registration.api_key, "test-api-key");
});
