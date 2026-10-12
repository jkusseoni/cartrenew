import assert from "node:assert/strict"
import test from "node:test"

import {
  anonymizedRetentionCart,
  applyRetention,
  isRetentionDryRun,
  RETENTION_ANY_MS,
  RETENTION_CART_COLUMNS,
  RETENTION_TERMINAL_MS,
  RETENTION_URL_MS,
  retentionBatchSize,
  retentionMessagePatch,
  retentionPlan,
  type RetentionCart,
} from "../lib/privacy/retention"

const NOW = Date.UTC(2026, 9, 12)
const EMAIL = "buyer@example.com"
const PHONE = "+15551234567"
const CHECKOUT = "https://demo.myshopify.com/cart/c/1?key=secret-key"

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString()
}

function cart(partial: Partial<RetentionCart> = {}): RetentionCart {
  return {
    id: "cart-1",
    storeId: "store-1",
    status: "pending",
    createdAt: ago(2 * 24 * 60 * 60 * 1000),
    messageSentAt: null,
    recoveryCompletedAt: null,
    lastSendFailedAt: null,
    customerPhone: PHONE,
    customerEmail: EMAIL,
    customerName: "Buyer",
    checkoutUrl: CHECKOUT,
    lastSendError: "provider echoed the address",
    items: [{ title: "Hat", image: "https://cdn.example/hat.jpg" }],
    ...partial,
  }
}

test("retention column list does not use updated_at", () => {
  assert.equal(RETENTION_CART_COLUMNS.includes("updated_at"), false)
  assert.equal(RETENTION_CART_COLUMNS.includes("message_sent_at"), true)
  assert.equal(RETENTION_CART_COLUMNS.includes("recovery_completed_at"), true)
  assert.equal(RETENTION_CART_COLUMNS.includes("last_send_failed_at"), true)
})

test("dry-run defaults on and the batch defaults to 100", () => {
  assert.equal(isRetentionDryRun(undefined), true)
  assert.equal(isRetentionDryRun("true"), true)
  assert.equal(isRetentionDryRun("false"), false)
  assert.equal(retentionBatchSize(undefined), 100)
  assert.equal(retentionBatchSize("0"), 100)
  assert.equal(retentionBatchSize("25"), 25)
})

test("30-day, 90-day, and 7-day rules use the status timestamp", () => {
  assert.equal(
    retentionPlan(cart({ status: "messaged", messageSentAt: ago(RETENTION_TERMINAL_MS), createdAt: ago(2 * 24 * 60 * 60 * 1000) }), NOW),
    "anonymize"
  )
  assert.equal(
    retentionPlan(
      cart({
        status: "messaged",
        messageSentAt: ago(RETENTION_TERMINAL_MS - 1),
        createdAt: ago(2 * 24 * 60 * 60 * 1000),
      }),
      NOW
    ),
    "none"
  )
  assert.equal(
    retentionPlan(
      cart({
        status: "recovered",
        messageSentAt: ago(24 * 60 * 60 * 1000),
        recoveryCompletedAt: ago(RETENTION_TERMINAL_MS + 1),
        createdAt: ago(40 * 24 * 60 * 60 * 1000),
      }),
      NOW
    ),
    "anonymize"
  )
  assert.equal(
    retentionPlan(
      cart({
        status: "lost",
        lastSendFailedAt: ago(24 * 60 * 60 * 1000),
        createdAt: ago(40 * 24 * 60 * 60 * 1000),
        checkoutUrl: null,
      }),
      NOW
    ),
    "none"
  )
  assert.equal(
    retentionPlan(
      cart({
        status: "lost",
        lastSendFailedAt: null,
        createdAt: ago(RETENTION_TERMINAL_MS),
      }),
      NOW
    ),
    "anonymize"
  )
  assert.equal(
    retentionPlan(cart({ status: "pending", createdAt: ago(RETENTION_ANY_MS) }), NOW),
    "anonymize"
  )
  assert.equal(
    retentionPlan(
      cart({
        status: "pending",
        createdAt: ago(RETENTION_URL_MS),
        customerPhone: null,
        customerEmail: null,
        customerName: null,
        lastSendError: null,
        items: [],
      }),
      NOW
    ),
    "clear-url"
  )
  assert.equal(
    retentionPlan(cart({ status: "pending", createdAt: ago(RETENTION_URL_MS - 1) }), NOW),
    "none"
  )
})

test("dry-run counts rows and does not write; a second pass changes nothing", async () => {
  const row = cart({ status: "messaged", messageSentAt: ago(RETENTION_TERMINAL_MS) })
  let writes = 0
  const dry = await applyRetention({
    carts: [row],
    now: NOW,
    dryRun: true,
    writeCart: async () => {
      writes += 1
    },
    writeMessages: async () => {
      writes += 1
    },
  })
  assert.equal(dry.dryRun, true)
  assert.equal(dry.anonymized, 1)
  assert.equal(writes, 0)
  assert.equal(row.customerEmail, EMAIL)
  assert.equal(JSON.stringify(dry).includes(EMAIL), false)
  assert.equal(JSON.stringify(dry).includes("key=secret-key"), false)

  const patch = anonymizedRetentionCart(row.items)
  assert.equal(patch.customer_email, null)
  assert.equal(patch.customer_phone, null)
  assert.equal(patch.checkout_url, null)
  assert.equal(patch.last_send_error, null)
  assert.deepEqual(patch.items, [{ title: "Hat" }])
  assert.equal(JSON.stringify(patch).includes("hat.jpg"), false)

  let liveWrites = 0
  await applyRetention({
    carts: [row],
    now: NOW,
    dryRun: false,
    writeCart: async () => {
      liveWrites += 1
      row.customerPhone = null
      row.customerEmail = null
      row.customerName = null
      row.checkoutUrl = null
      row.lastSendError = null
      row.items = patch.items
    },
    writeMessages: async () => {
      liveWrites += 1
    },
  })
  assert.equal(liveWrites, 2)
  assert.equal(retentionPlan(row, NOW), "none")
  assert.equal("email" in retentionMessagePatch(false), false)
  assert.equal(retentionMessagePatch(true).email, null)
})
