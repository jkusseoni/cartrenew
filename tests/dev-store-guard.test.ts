import assert from "node:assert/strict"
import test from "node:test"

import {
  guardShopifyShopWrite,
  planIsDevelopmentStore,
  type ShopPlan,
} from "../lib/shopify/dev-store-guard"

const SHOP = "dev-store.myshopify.com"
const DEVELOPMENT: ShopPlan = { displayName: "Development", partnerDevelopment: false }
const BASIC: ShopPlan = { displayName: "Basic", partnerDevelopment: false }
const PLUS_SANDBOX: ShopPlan = { displayName: "Shopify Plus", partnerDevelopment: true }

function calls() {
  return { token: 0, plan: 0 }
}

test("Pingza production blocks a development store and an allowlisted shop", async () => {
  const counted = calls()
  const byPlan = await guardShopifyShopWrite({
    shop: SHOP,
    isDefaultBrand: false,
    vercelEnv: "production",
    allowDevStores: undefined,
    devShopList: undefined,
    readAccessToken: async () => {
      counted.token += 1
      return "token"
    },
    readPlan: async () => {
      counted.plan += 1
      return DEVELOPMENT
    },
  })
  assert.equal(byPlan, "block")

  const byFlag = await guardShopifyShopWrite({
    shop: SHOP,
    isDefaultBrand: false,
    vercelEnv: "production",
    allowDevStores: "false",
    devShopList: undefined,
    readAccessToken: async () => "token",
    readPlan: async () => PLUS_SANDBOX,
  })
  assert.equal(byFlag, "block")

  const listed = calls()
  const byList = await guardShopifyShopWrite({
    shop: SHOP,
    isDefaultBrand: false,
    vercelEnv: "production",
    allowDevStores: "",
    devShopList: "other.myshopify.com, dev-store.myshopify.com",
    readAccessToken: async () => {
      listed.token += 1
      return "token"
    },
    readPlan: async () => {
      listed.plan += 1
      return BASIC
    },
  })
  assert.equal(byList, "block")
  assert.equal(listed.token, 0)
  assert.equal(listed.plan, 0)
  assert.equal(counted.plan, 1)
  assert.equal(planIsDevelopmentStore(DEVELOPMENT), true)
  assert.equal(
    planIsDevelopmentStore({ displayName: "Developer Preview", partnerDevelopment: false }),
    true
  )

  const unavailable = await guardShopifyShopWrite({
    shop: "live-store.myshopify.com",
    isDefaultBrand: false,
    vercelEnv: "production",
    allowDevStores: undefined,
    devShopList: undefined,
    readAccessToken: async () => "token",
    readPlan: async () => {
      throw new Error("plan_lookup_failed")
    },
  })
  assert.equal(unavailable, "retry")
})

test("Pingza preview allows a development store and ignores PINGZA_ALLOW_DEV_STORES", async () => {
  for (const allowDevStores of [undefined, "false", "true"]) {
    const counted = calls()
    const decision = await guardShopifyShopWrite({
      shop: SHOP,
      isDefaultBrand: false,
      vercelEnv: "preview",
      allowDevStores,
      devShopList: SHOP,
      readAccessToken: async () => {
        counted.token += 1
        return "token"
      },
      readPlan: async () => {
        counted.plan += 1
        return DEVELOPMENT
      },
    })
    assert.equal(decision, "allow")
    assert.equal(counted.token, 0)
    assert.equal(counted.plan, 0)
  }
})

test("CartRenew production still allows a development store", async () => {
  const counted = calls()
  const decision = await guardShopifyShopWrite({
    shop: SHOP,
    isDefaultBrand: true,
    vercelEnv: "production",
    allowDevStores: "false",
    devShopList: SHOP,
    readAccessToken: async () => {
      counted.token += 1
      return "token"
    },
    readPlan: async () => {
      counted.plan += 1
      return DEVELOPMENT
    },
  })
  assert.equal(decision, "allow")
  assert.equal(counted.token, 0)
  assert.equal(counted.plan, 0)
})

test("Pingza production allows a live plan and a store when dev writes are enabled", async () => {
  const live = await guardShopifyShopWrite({
    shop: "live-store.myshopify.com",
    isDefaultBrand: false,
    vercelEnv: "production",
    allowDevStores: undefined,
    devShopList: undefined,
    readAccessToken: async () => "token",
    readPlan: async () => BASIC,
  })
  assert.equal(live, "allow")

  const counted = calls()
  const allowed = await guardShopifyShopWrite({
    shop: SHOP,
    isDefaultBrand: false,
    vercelEnv: "production",
    allowDevStores: "true",
    devShopList: SHOP,
    readAccessToken: async () => {
      counted.token += 1
      return "token"
    },
    readPlan: async () => {
      counted.plan += 1
      return DEVELOPMENT
    },
  })
  assert.equal(allowed, "allow")
  assert.equal(counted.token, 0)
  assert.equal(counted.plan, 0)
})
