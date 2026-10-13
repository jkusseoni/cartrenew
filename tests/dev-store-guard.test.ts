import assert from "node:assert/strict"
import test from "node:test"

import {
  guardShopifyShopWrite,
  guardShopifyUninstallWrite,
  planIsDevelopmentStore,
  resetDevStoreGuardCacheForTests,
  ShopPlanUnauthorizedError,
  type ShopPlan,
} from "../lib/shopify/dev-store-guard"

const SHOP = "dev-store.myshopify.com"
const LIVE = "live-store.myshopify.com"
const DEVELOPMENT: ShopPlan = { displayName: "Development", partnerDevelopment: false }
const BASIC: ShopPlan = { displayName: "Basic", partnerDevelopment: false }
const PLUS_SANDBOX: ShopPlan = { displayName: "Shopify Plus", partnerDevelopment: true }

const PINGZA_PRODUCTION = {
  isDefaultBrand: false,
  vercelEnv: "production",
  allowDevStores: undefined,
  devShopList: undefined,
}

function counter() {
  return { token: 0, plan: 0 }
}

test("Pingza production blocks a development store and an allowlisted shop", async () => {
  resetDevStoreGuardCacheForTests()
  const counted = counter()
  const byPlan = await guardShopifyShopWrite({
    ...PINGZA_PRODUCTION,
    shop: SHOP,
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
  assert.equal(counted.plan, 1)

  resetDevStoreGuardCacheForTests()
  const byFlag = await guardShopifyShopWrite({
    ...PINGZA_PRODUCTION,
    allowDevStores: "false",
    shop: SHOP,
    readAccessToken: async () => "token",
    readPlan: async () => PLUS_SANDBOX,
  })
  assert.equal(byFlag, "block")

  const listed = counter()
  const byList = await guardShopifyShopWrite({
    ...PINGZA_PRODUCTION,
    allowDevStores: "",
    devShopList: "other.myshopify.com, DEV-store.myshopify.com",
    shop: SHOP,
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

  assert.equal(planIsDevelopmentStore(DEVELOPMENT), true)
  assert.equal(planIsDevelopmentStore({ displayName: "Developer Preview", partnerDevelopment: false }), true)
  assert.equal(planIsDevelopmentStore(BASIC), false)
})

test("Pingza production writes nothing without a usable token and retries on lookup failure", async () => {
  resetDevStoreGuardCacheForTests()
  const noToken = await guardShopifyShopWrite({
    ...PINGZA_PRODUCTION,
    shop: LIVE,
    readAccessToken: async () => null,
    readPlan: async () => BASIC,
  })
  assert.equal(noToken, "block")

  const rejected = await guardShopifyShopWrite({
    ...PINGZA_PRODUCTION,
    shop: LIVE,
    readAccessToken: async () => "revoked",
    readPlan: async () => {
      throw new ShopPlanUnauthorizedError()
    },
  })
  assert.equal(rejected, "block")

  const tokenDown = await guardShopifyShopWrite({
    ...PINGZA_PRODUCTION,
    shop: LIVE,
    readAccessToken: async () => {
      throw new Error("token_unavailable")
    },
    readPlan: async () => BASIC,
  })
  assert.equal(tokenDown, "retry")

  const planDown = await guardShopifyShopWrite({
    ...PINGZA_PRODUCTION,
    shop: LIVE,
    readAccessToken: async () => "token",
    readPlan: async () => {
      throw new Error("plan_lookup_failed")
    },
  })
  assert.equal(planDown, "retry")
})

test("Pingza production caches a plan result for each shop", async () => {
  resetDevStoreGuardCacheForTests()
  const counted = counter()
  const run = (now: number) =>
    guardShopifyShopWrite({
      ...PINGZA_PRODUCTION,
      shop: LIVE,
      now,
      readAccessToken: async () => {
        counted.token += 1
        return "token"
      },
      readPlan: async () => {
        counted.plan += 1
        return BASIC
      },
    })

  assert.equal(await run(1_000), "allow")
  assert.equal(await run(2_000), "allow")
  assert.equal(counted.plan, 1)
  assert.equal(counted.token, 1)
  assert.equal(await run(1_000 + 11 * 60 * 1000), "allow")
  assert.equal(counted.plan, 2)
})

test("Pingza production uninstall cleans an existing row and never inserts one", async () => {
  resetDevStoreGuardCacheForTests()
  assert.equal(
    await guardShopifyUninstallWrite({ ...PINGZA_PRODUCTION, shop: LIVE, storeExists: async () => true }),
    "allow"
  )
  assert.equal(
    await guardShopifyUninstallWrite({ ...PINGZA_PRODUCTION, shop: LIVE, storeExists: async () => false }),
    "block"
  )
  assert.equal(
    await guardShopifyUninstallWrite({
      ...PINGZA_PRODUCTION,
      devShopList: SHOP,
      shop: SHOP,
      storeExists: async () => true,
    }),
    "block"
  )
  assert.equal(
    await guardShopifyUninstallWrite({
      ...PINGZA_PRODUCTION,
      shop: LIVE,
      storeExists: async () => {
        throw new Error("store_lookup_failed")
      },
    }),
    "retry"
  )
})

test("Pingza preview allows a development store and ignores PINGZA_ALLOW_DEV_STORES", async () => {
  resetDevStoreGuardCacheForTests()
  for (const allowDevStores of [undefined, "false", "true"]) {
    const counted = counter()
    const decision = await guardShopifyShopWrite({
      isDefaultBrand: false,
      vercelEnv: "preview",
      allowDevStores,
      devShopList: SHOP,
      shop: SHOP,
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
    assert.equal(
      await guardShopifyUninstallWrite({
        isDefaultBrand: false,
        vercelEnv: "preview",
        allowDevStores,
        devShopList: SHOP,
        shop: SHOP,
        storeExists: async () => false,
      }),
      "allow"
    )
  }
})

test("CartRenew production still allows a development store", async () => {
  resetDevStoreGuardCacheForTests()
  const counted = counter()
  const decision = await guardShopifyShopWrite({
    isDefaultBrand: true,
    vercelEnv: "production",
    allowDevStores: "false",
    devShopList: SHOP,
    shop: SHOP,
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
  assert.equal(
    await guardShopifyUninstallWrite({
      isDefaultBrand: true,
      vercelEnv: "production",
      allowDevStores: "false",
      devShopList: SHOP,
      shop: SHOP,
      storeExists: async () => false,
    }),
    "allow"
  )
})

test("Pingza production allows a live plan, and every store when dev writes are enabled", async () => {
  resetDevStoreGuardCacheForTests()
  const live = await guardShopifyShopWrite({
    ...PINGZA_PRODUCTION,
    shop: LIVE,
    readAccessToken: async () => "token",
    readPlan: async () => BASIC,
  })
  assert.equal(live, "allow")

  const counted = counter()
  const allowed = await guardShopifyShopWrite({
    ...PINGZA_PRODUCTION,
    allowDevStores: "true",
    devShopList: SHOP,
    shop: SHOP,
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
