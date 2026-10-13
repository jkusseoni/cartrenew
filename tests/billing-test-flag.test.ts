import assert from "node:assert/strict"
import test from "node:test"

import { isShopifyBillingTestFlagActive } from "../lib/shopify/billing"

test("CartRenew still honors SHOPIFY_BILLING_TEST", () => {
  assert.equal(
    isShopifyBillingTestFlagActive({
      isDefaultBrand: true,
      billingTest: "true",
      vercelEnv: "production",
    }),
    true
  )
  assert.equal(
    isShopifyBillingTestFlagActive({
      isDefaultBrand: true,
      billingTest: "true",
      vercelEnv: "preview",
    }),
    true
  )
  assert.equal(
    isShopifyBillingTestFlagActive({
      isDefaultBrand: true,
      billingTest: undefined,
      vercelEnv: "production",
    }),
    false
  )
})

test("Pingza production ignores SHOPIFY_BILLING_TEST", () => {
  assert.equal(
    isShopifyBillingTestFlagActive({
      isDefaultBrand: false,
      billingTest: "true",
      vercelEnv: "production",
    }),
    false
  )
  assert.equal(
    isShopifyBillingTestFlagActive({
      isDefaultBrand: false,
      billingTest: "true",
      vercelEnv: "preview",
    }),
    true
  )
  assert.equal(
    isShopifyBillingTestFlagActive({
      isDefaultBrand: false,
      billingTest: "false",
      vercelEnv: "production",
    }),
    false
  )
})
