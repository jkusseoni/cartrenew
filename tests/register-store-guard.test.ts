import assert from "node:assert/strict"
import test from "node:test"

import { publicSupportEmail, PINGZA_SUPPORT_EMAIL } from "../lib/legal/pingza"
import {
  authorizeRegisterStore,
  REGISTER_STORE_GENERIC_ERROR,
  resetRegisterStoreRateLimitsForTests,
} from "../lib/privacy/register-store-guard"

const SHOP = "demo.myshopify.com"

test("CartRenew register-store guard does not check a session token", async () => {
  resetRegisterStoreRateLimitsForTests()
  let called = false
  const decision = await authorizeRegisterStore({
    isDefaultBrand: true,
    authorization: null,
    forwardedFor: "203.0.113.5",
    now: 1_000,
    verify: async () => {
      called = true
      return { shop: SHOP }
    },
  })
  assert.equal(decision.ok, true)
  assert.equal(called, false)
})

test("Pingza register-store requires a session token and rate limits IP and shop", async () => {
  resetRegisterStoreRateLimitsForTests()
  const secret = "session-token-value"
  const verify = async (token: string) => {
    if (token !== secret) throw new Error(`bad token for buyer@example.com dest=${SHOP}`)
    return { shop: SHOP }
  }

  const missing = await authorizeRegisterStore({
    isDefaultBrand: false,
    authorization: null,
    forwardedFor: "203.0.113.8",
    now: 2_000,
    verify,
  })
  assert.deepEqual(missing, { ok: false, status: 401 })

  const invalid = await authorizeRegisterStore({
    isDefaultBrand: false,
    authorization: "Bearer not-the-token",
    forwardedFor: "203.0.113.9",
    now: 2_000,
    verify,
  })
  assert.deepEqual(invalid, { ok: false, status: 401 })
  assert.equal(REGISTER_STORE_GENERIC_ERROR.includes("buyer@example.com"), false)
  assert.equal(REGISTER_STORE_GENERIC_ERROR.includes(secret), false)

  resetRegisterStoreRateLimitsForTests()
  for (let i = 0; i < 10; i += 1) {
    const ok = await authorizeRegisterStore({
      isDefaultBrand: false,
      authorization: `Bearer ${secret}`,
      forwardedFor: "203.0.113.10",
      now: 3_000,
      verify,
    })
    assert.equal(ok.ok, true)
  }
  const limitedIp = await authorizeRegisterStore({
    isDefaultBrand: false,
    authorization: `Bearer ${secret}`,
    forwardedFor: "203.0.113.10",
    now: 3_000,
    verify,
  })
  assert.deepEqual(limitedIp, { ok: false, status: 429 })

  resetRegisterStoreRateLimitsForTests()
  for (let i = 0; i < 10; i += 1) {
    const ok = await authorizeRegisterStore({
      isDefaultBrand: false,
      authorization: `Bearer ${secret}`,
      forwardedFor: `203.0.113.${20 + i}`,
      now: 4_000,
      verify,
    })
    assert.equal(ok.ok, true)
    if (ok.ok) assert.equal(ok.shop, SHOP)
  }
  const limitedShop = await authorizeRegisterStore({
    isDefaultBrand: false,
    authorization: `Bearer ${secret}`,
    forwardedFor: "203.0.113.80",
    now: 4_000,
    verify,
  })
  assert.deepEqual(limitedShop, { ok: false, status: 429 })
})

test("Pingza public contact is not the CartRenew address", () => {
  assert.equal(publicSupportEmail(true, "contact@cartrenew.com"), "contact@cartrenew.com")
  assert.equal(publicSupportEmail(false, "contact@cartrenew.com"), PINGZA_SUPPORT_EMAIL)
  assert.equal(publicSupportEmail(false, ""), PINGZA_SUPPORT_EMAIL)
})
