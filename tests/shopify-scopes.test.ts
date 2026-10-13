import assert from "node:assert/strict"
import test from "node:test"

import { brand } from "../lib/brand"
import { getShopifyScopes, SHOPIFY_SCOPES, shopifyScopesForBrand } from "../lib/shopify/config"

test("CartRenew Shopify scopes stay read_orders, write_orders, read_checkouts", () => {
  assert.equal(brand.isDefault, true)
  assert.deepEqual(shopifyScopesForBrand(true), [
    "read_orders",
    "write_orders",
    "read_checkouts",
  ])
  assert.deepEqual(SHOPIFY_SCOPES, ["read_orders", "write_orders", "read_checkouts"])
  assert.equal(getShopifyScopes(true), "read_orders,write_orders,read_checkouts")
  assert.equal(getShopifyScopes(), "read_orders,write_orders,read_checkouts")
})

test("Pingza Shopify scopes omit write_orders", () => {
  assert.deepEqual(shopifyScopesForBrand(false), ["read_orders", "read_checkouts"])
  assert.equal(getShopifyScopes(false), "read_orders,read_checkouts")
  assert.equal(getShopifyScopes(false).includes("write_orders"), false)
})
