import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import {
  handleShopifyRequest,
  shouldBypassAuthForShopify,
} from "../../proxy";

function request(path: string) {
  return new NextRequest(`https://cartrenew.example${path}`);
}

test("Shopify query parameters do not bypass auth on protected pages", () => {
  assert.equal(
    shouldBypassAuthForShopify(
      request("/en/dashboard/admin/stores?shop=attacker.myshopify.com")
    ),
    false
  );
  assert.equal(
    shouldBypassAuthForShopify(
      request("/en/dashboard/admin/stores?host=ZXhhbXBsZS5teXNob3BpZnkuY29t")
    ),
    false
  );
});

test("root Shopify launches still bypass auth and redirect to /app", () => {
  const launch = request(
    "/?shop=merchant.myshopify.com&host=bWVyY2hhbnQubXlzaG9waWZ5LmNvbQ"
  );

  assert.equal(shouldBypassAuthForShopify(launch), true);

  const response = handleShopifyRequest(launch);
  assert.ok(response);
  assert.equal(response.status, 307);

  const location = new URL(response.headers.get("location")!);
  assert.equal(location.pathname, "/app");
  assert.equal(location.searchParams.get("shop"), "merchant.myshopify.com");
  assert.equal(
    location.searchParams.get("host"),
    "bWVyY2hhbnQubXlzaG9waWZ5LmNvbQ"
  );
});

test("/app routes retain the Shopify auth bypass", () => {
  for (const path of ["/app", "/app/billing"]) {
    const appRequest = request(path);
    assert.equal(shouldBypassAuthForShopify(appRequest), true);
    assert.ok(handleShopifyRequest(appRequest));
  }
});

test("only /api/app and its descendants retain the Shopify API bypass", () => {
  assert.equal(shouldBypassAuthForShopify(request("/api/app")), true);
  assert.equal(
    shouldBypassAuthForShopify(request("/api/app/dashboard")),
    true
  );
  assert.equal(
    shouldBypassAuthForShopify(request("/api/application?shop=attacker.myshopify.com")),
    false
  );
});
