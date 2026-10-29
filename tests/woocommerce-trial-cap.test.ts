import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_FREE_MESSAGE_LIMIT,
  evaluateTrialCap,
  resolveFreeMessageLimit,
} from "../lib/woocommerce/trial-cap"

const base = { billingStatus: "pending", messageCapOverride: null, used: 0, defaultLimit: 25 }

test("unpaid store may send until the default cap is used up", () => {
  assert.equal(evaluateTrialCap({ ...base, used: 24 }).allowed, true)
  const blocked = evaluateTrialCap({ ...base, used: 25 })
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.reason, "limit_reached")
  assert.equal(blocked.limit, 25)
})

test("active billing is exempt regardless of usage (any casing)", () => {
  for (const status of ["active", "ACTIVE", "Active"]) {
    const result = evaluateTrialCap({ ...base, billingStatus: status, used: 10_000 })
    assert.equal(result.allowed, true)
    assert.equal(result.reason, "billing_active")
  }
})

test("other billing states are still capped", () => {
  for (const status of ["pending", "declined", "cancelled", "expired", "frozen", null, undefined]) {
    assert.equal(evaluateTrialCap({ ...base, billingStatus: status, used: 25 }).allowed, false)
  }
})

test("per-store override replaces the default, negative means unlimited", () => {
  assert.equal(evaluateTrialCap({ ...base, messageCapOverride: 100, used: 50 }).allowed, true)
  assert.equal(evaluateTrialCap({ ...base, messageCapOverride: 100, used: 100 }).allowed, false)
  assert.equal(evaluateTrialCap({ ...base, messageCapOverride: 0, used: 0 }).allowed, false)
  const unlimited = evaluateTrialCap({ ...base, messageCapOverride: -1, used: 99_999 })
  assert.equal(unlimited.allowed, true)
  assert.equal(unlimited.limit, null)
})

test("env limit parsing falls back to the default and negative disables the cap", () => {
  assert.equal(resolveFreeMessageLimit(undefined), DEFAULT_FREE_MESSAGE_LIMIT)
  assert.equal(resolveFreeMessageLimit(""), DEFAULT_FREE_MESSAGE_LIMIT)
  assert.equal(resolveFreeMessageLimit("abc"), DEFAULT_FREE_MESSAGE_LIMIT)
  assert.equal(resolveFreeMessageLimit("40"), 40)
  assert.equal(resolveFreeMessageLimit("12.9"), 12)
  assert.equal(evaluateTrialCap({ ...base, defaultLimit: resolveFreeMessageLimit("-1"), used: 5000 }).allowed, true)
})
