import assert from "node:assert/strict";
import test from "node:test";

import { shouldBypassAuthForShopify } from "../../lib/shopify/proxy-routing";

test("bypasses Clerk only on Shopify-authenticated routes", () => {
  assert.equal(shouldBypassAuthForShopify("/app"), true);
  assert.equal(shouldBypassAuthForShopify("/app/settings"), true);
  assert.equal(shouldBypassAuthForShopify("/shopify"), true);
  assert.equal(shouldBypassAuthForShopify("/api/app/dashboard"), true);
});

test("does not let Shopify launch parameters bypass protected pages", () => {
  const protectedPaths = [
    "/en/admin",
    "/en/dashboard",
    "/en/dashboard/admin/stores",
    "/en/settings",
  ];

  for (const pathname of protectedPaths) {
    assert.equal(
      shouldBypassAuthForShopify(pathname),
      false,
      `${pathname}?shop=attacker.myshopify.com&host=attacker must remain Clerk-protected`
    );
  }
});
