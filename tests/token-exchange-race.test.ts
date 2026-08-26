import assert from "node:assert/strict";
import test from "node:test";

test("duplicate store insert persists the exchanged token without resetting billing", async () => {
  const envKeys = [
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
    "SHOPIFY_APP_URL",
  ] as const;
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]])
  );

  process.env.SHOPIFY_API_KEY = "test-client-id";
  process.env.SHOPIFY_API_SECRET = "test-client-secret";
  process.env.SHOPIFY_APP_URL = "https://app.example.com";

  const { SignJWT } = await import("jose");
  const { NextRequest } = await import("next/server");
  const { POST } = await import("../app/api/auth/token-exchange/route");
  const { prisma } = await import("../lib/prisma");
  const { supabaseAdmin } = await import("../lib/supabase");
  const { WEBHOOK_TOPICS } = await import("../lib/shopify/webhooks");

  const shop = "race-shop.myshopify.com";
  const store = {
    id: "webhook-created-store",
    shopify_domain: shop,
    shopify_access_token: null as string | null,
    billing_status: "active",
  };
  const updates: Array<Record<string, unknown>> = [];
  let storeLookupCount = 0;

  const originalFindUnique = prisma.merchant.findUnique;
  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);
  const originalFetch = globalThis.fetch;

  (prisma.merchant.findUnique as unknown as () => Promise<unknown>) = async () => ({
    id: "merchant-1",
  });

  (supabaseAdmin as unknown as { from: (table: string) => unknown }).from = () => {
    let action: "lookup" | "insert" | "update" = "lookup";
    let patch: Record<string, unknown> = {};

    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      insert() {
        action = "insert";
        return this;
      },
      update(value: Record<string, unknown>) {
        action = "update";
        patch = value;
        updates.push(value);
        return this;
      },
      async maybeSingle() {
        if (action === "insert") {
          return {
            data: null,
            error: { code: "23505", message: "duplicate shopify_domain" },
          };
        }
        if (action === "update") {
          Object.assign(store, patch);
          return { data: { id: store.id }, error: null };
        }
        storeLookupCount += 1;
        return storeLookupCount === 1
          ? { data: null, error: null }
          : { data: { id: store.id }, error: null };
      },
      then(
        resolve: (value: { data: null; error: null }) => unknown,
        reject: (reason: unknown) => unknown
      ) {
        if (action === "update") Object.assign(store, patch);
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      },
    };
  };

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/admin/oauth/access_token")) {
      return Response.json({ access_token: "fresh-offline-token" });
    }
    if (url.endsWith("/webhooks.json")) {
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
    const sessionToken = await new SignJWT({
      aud: process.env.SHOPIFY_API_KEY,
      dest: `https://${shop}`,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(process.env.SHOPIFY_API_SECRET));

    const response = await POST(
      new NextRequest("https://app.example.com/api/auth/token-exchange", {
        method: "POST",
        headers: { authorization: `Bearer ${sessionToken}` },
      })
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.storeId, store.id);
    assert.equal(store.shopify_access_token, "fresh-offline-token");
    assert.equal(store.billing_status, "active");
    assert.deepEqual(updates[0], {
      shopify_access_token: "fresh-offline-token",
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
