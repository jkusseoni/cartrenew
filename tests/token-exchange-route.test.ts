import assert from "node:assert/strict";

import { test } from "@playwright/test";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

import { POST } from "../app/api/auth/token-exchange/route";
import { prisma } from "../lib/prisma";
import { supabaseAdmin } from "../lib/supabase";
import { WEBHOOK_TOPICS } from "../lib/shopify/webhooks";

type StoreFixture = {
  id: string;
  clerk_user_id: string;
  billing_status: string;
  billing_plan: string;
  shopify_subscription_id: string;
  billing_trial_ends_at: string;
  billing_current_period_end: string;
  shopify_access_token?: string;
};

test("token exchange preserves existing billing state and initializes new stores", async () => {
  const envKeys = [
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
    "SHOPIFY_APP_URL",
  ] as const;
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]])
  );

  process.env.SHOPIFY_API_KEY = "test-client-id";
  process.env.SHOPIFY_API_SECRET = "test-secret";
  process.env.SHOPIFY_APP_URL = "https://app.example.com";

  const originalFindUnique = prisma.merchant.findUnique;
  (prisma.merchant.findUnique as unknown as () => Promise<unknown>) = async () => ({
    id: "merchant-1",
  });

  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);
  let currentStore: StoreFixture | null = null;
  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];

  (supabaseAdmin as unknown as { from: (table: string) => unknown }).from = () => {
    let action: "lookup" | "update" | "insert" = "lookup";
    let payload: Record<string, unknown> = {};

    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      update(value: Record<string, unknown>) {
        action = "update";
        payload = value;
        updates.push(value);
        return this;
      },
      insert(value: Record<string, unknown>) {
        action = "insert";
        payload = value;
        inserts.push(value);
        return this;
      },
      async maybeSingle() {
        if (action === "update") {
          if (currentStore && "shopify_access_token" in payload) {
            Object.assign(currentStore, payload);
          }
          return {
            data: currentStore
              ? {
                  id: currentStore.id,
                  billing_status: currentStore.billing_status,
                }
              : { id: "new-store-id" },
            error: null,
          };
        }
        if (action === "insert") {
          return { data: { id: "new-store-id" }, error: null };
        }
        return {
          data: currentStore ? { ...currentStore } : null,
          error: null,
        };
      },
      then(
        resolve: (value: { data: null; error: null }) => unknown,
        reject: (reason: unknown) => unknown
      ) {
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      },
    };
  };

  const originalFetch = globalThis.fetch;
  let offlineToken = "offline-token";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/admin/oauth/access_token")) {
      return Response.json({ access_token: offlineToken });
    }
    if (url.endsWith("/webhooks.json") && init?.method === "GET") {
      return Response.json({
        webhooks: WEBHOOK_TOPICS.map((topic, index) => ({
          id: index + 1,
          topic,
          address: "https://app.example.com/api/webhooks/shopify",
        })),
      });
    }
    return Response.json({ error: "unexpected request" }, { status: 500 });
  }) as typeof fetch;

  try {
    const shop = "paid-store.myshopify.com";

    async function exchangeToken() {
      const sessionToken = await new SignJWT({
        aud: process.env.SHOPIFY_API_KEY,
        dest: `https://${shop}`,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(new TextEncoder().encode(process.env.SHOPIFY_API_SECRET));

      return POST(
        new NextRequest("https://app.example.com/api/auth/token-exchange", {
          method: "POST",
          headers: { authorization: `Bearer ${sessionToken}` },
        })
      );
    }

    currentStore = {
      id: "existing-store-id",
      clerk_user_id: "merchant-1",
      billing_status: "active",
      billing_plan: "growth",
      shopify_subscription_id: "gid://shopify/AppSubscription/123",
      billing_trial_ends_at: "2026-09-01T00:00:00.000Z",
      billing_current_period_end: "2026-10-01T00:00:00.000Z",
    };
    const existingResponse = await exchangeToken();

    assert.equal(existingResponse.status, 200);
    assert.deepEqual(updates[0], { shopify_access_token: "offline-token" });
    assert.equal(currentStore.billing_status, "active");
    assert.equal(currentStore.billing_plan, "growth");
    assert.equal(
      currentStore.shopify_subscription_id,
      "gid://shopify/AppSubscription/123"
    );
    assert.equal(currentStore.billing_trial_ends_at, "2026-09-01T00:00:00.000Z");
    assert.equal(
      currentStore.billing_current_period_end,
      "2026-10-01T00:00:00.000Z"
    );

    currentStore = null;
    updates.length = 0;
    offlineToken = "new-store-offline-token";
    const newStoreResponse = await exchangeToken();

    assert.equal(newStoreResponse.status, 200);
    assert.deepEqual(inserts[0], {
      shopify_domain: shop,
      shopify_access_token: "new-store-offline-token",
      clerk_user_id: "webhook_paid_store_myshopify_com",
      platform: "shopify",
      billing_status: "pending",
    });
  } finally {
    globalThis.fetch = originalFetch;
    (supabaseAdmin as unknown as { from: typeof originalFrom }).from = originalFrom;
    prisma.merchant.findUnique = originalFindUnique;
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    await prisma.$disconnect();
  }
});
