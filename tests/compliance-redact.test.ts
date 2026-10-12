import assert from "node:assert/strict"
import crypto from "node:crypto"
import test from "node:test"

import {
  anonymizedCartUpdate,
  anonymizedMessageUpdate,
  runCompliance,
  type PrivacyCart,
  type PrivacyDb,
  type PrivacyMessage,
  type PrivacySuppression,
  type StoreScopedTable,
} from "../lib/privacy/compliance"
import { PrivacyConfigError, PrivacyDbError } from "../lib/privacy/compliance-errors"
import { isSuppressionHmac, suppressionHmac, suppressionLookupKeys } from "../lib/privacy/suppression-hash"

const SECRET = "suppression-test-secret"
const SHOP = "demo.myshopify.com"
const EMAIL = "buyer@example.com"
const PHONE = "555-123-4567"
const CHECKOUT = "https://demo.myshopify.com/cart/c/1?key=secret-key"

type CartRow = PrivacyCart & { storeId: string; token: string }
type MessageRow = PrivacyMessage & { storeId: string }

type Memory = {
  stores: Record<string, string>
  carts: CartRow[]
  messages: MessageRow[]
  suppressions: PrivacySuppression[]
  suppressionCode?: string
  cartCode?: string
  calls: string[]
  messageEmailFlag: boolean | null
}

function cart(partial: Partial<CartRow> = {}): CartRow {
  return {
    id: "cart-1",
    storeId: "store-1",
    token: "tok-1",
    customerEmail: EMAIL,
    customerPhone: "+1 555 123 4567",
    customerName: "Buyer",
    checkoutUrl: CHECKOUT,
    status: "messaged",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  }
}

function memory(seed: Partial<Memory> = {}): { db: PrivacyDb; state: Memory } {
  const state: Memory = {
    stores: { [SHOP]: "store-1" },
    carts: [cart()],
    messages: [
      {
        id: "msg-1",
        storeId: "store-1",
        cartId: "cart-1",
        phone: "+15551234567",
        email: EMAIL,
        body: "hello",
        templateName: "abandoned_cart_reminder",
        status: "sent",
        createdAt: "2026-01-01T00:00:00.000Z",
        sentAt: "2026-01-01T01:00:00.000Z",
      },
    ],
    suppressions: [{ id: "sup-1", email: EMAIL, storeId: "store-1" }],
    calls: [],
    messageEmailFlag: null,
    ...seed,
  }

  const db: PrivacyDb = {
    async findStoreId(shopDomain) {
      return state.stores[shopDomain] ?? null
    },
    async listCarts(storeId) {
      if (state.cartCode) throw new PrivacyDbError(state.cartCode)
      return state.carts.filter((row) => row.storeId === storeId)
    },
    async anonymizeCart(storeId, cartId, replacementToken) {
      const row = state.carts.find((item) => item.storeId === storeId && item.id === cartId)
      if (!row) return
      row.customerEmail = null
      row.customerPhone = null
      row.customerName = null
      row.checkoutUrl = null
      row.token = replacementToken
    },
    async listMessagesForCarts() {
      return []
    },
    async anonymizeMessages(storeId, cartId, includeEmail) {
      state.messageEmailFlag = includeEmail
      let count = 0
      for (const row of state.messages) {
        if (row.storeId !== storeId || row.cartId !== cartId) continue
        row.phone = null
        row.body = null
        if (includeEmail) row.email = null
        count += 1
      }
      return count
    },
    async listSuppressionsForStore(storeId) {
      if (state.suppressionCode) throw new PrivacyDbError(state.suppressionCode)
      return state.suppressions.filter((row) => row.storeId === storeId)
    },
    async listSuppressionsByEmail(emails) {
      if (state.suppressionCode) throw new PrivacyDbError(state.suppressionCode)
      return state.suppressions.filter((row) => emails.includes(row.email))
    },
    async updateSuppression(id, email, storeId) {
      const clash = state.suppressions.find((row) => row.email === email && row.id !== id)
      if (clash) return "duplicate"
      const row = state.suppressions.find((item) => item.id === id)
      if (!row) return "updated"
      row.email = email
      row.storeId = storeId
      return "updated"
    },
    async deleteSuppression(id) {
      state.suppressions = state.suppressions.filter((row) => row.id !== id)
    },
    async deleteStoreScoped(table: StoreScopedTable, storeId) {
      state.calls.push(table)
      if (table === "messages") state.messages = state.messages.filter((row) => row.storeId !== storeId)
      if (table === "abandoned_carts") state.carts = state.carts.filter((row) => row.storeId !== storeId)
    },
    async deleteStore(storeId) {
      state.calls.push("stores")
      for (const [domain, id] of Object.entries(state.stores)) {
        if (id === storeId) delete state.stores[domain]
      }
    },
  }

  return { db, state }
}

test("anonymized rows clear contact fields and the message error", () => {
  const cartUpdate = anonymizedCartUpdate("redacted:fixed")
  assert.equal(cartUpdate.customer_phone, null)
  assert.equal(cartUpdate.customer_email, null)
  assert.equal(cartUpdate.customer_name, null)
  assert.equal(cartUpdate.checkout_url, null)
  assert.equal(cartUpdate.last_send_error, null)
  assert.equal(cartUpdate.shopify_cart_token, "redacted:fixed")
  assert.deepEqual(cartUpdate.items, [])

  const messageUpdate = anonymizedMessageUpdate(true)
  assert.equal(messageUpdate.phone, null)
  assert.equal(messageUpdate.email, null)
  assert.equal(messageUpdate.body, null)
  assert.equal(messageUpdate.error_message, null)
  assert.equal("email" in anonymizedMessageUpdate(false), false)
})

test("suppression hash is HMAC-SHA256 and the send lookup accepts both forms", () => {
  const hashed = suppressionHmac(EMAIL, SECRET)
  assert.ok(hashed)
  assert.equal(isSuppressionHmac(hashed), true)
  const plain = crypto.createHash("sha256").update(EMAIL).digest("hex")
  assert.notEqual(hashed, `hmac1:${plain}`)
  assert.notEqual(suppressionHmac(EMAIL, "other-secret"), hashed)
  assert.equal(suppressionHmac(hashed, SECRET), null)
  assert.deepEqual(suppressionLookupKeys(EMAIL, SECRET), [EMAIL, hashed])
  assert.deepEqual(suppressionLookupKeys(EMAIL, ""), [EMAIL])
})

test("customers/redact matches email or phone and hashes the suppression", async () => {
  const emailRun = memory()
  const phoneRun = memory({
    carts: [cart({ customerEmail: "other@example.com", customerPhone: "+15551234567" })],
  })

  for (const { db, state } of [emailRun, phoneRun]) {
    const entries: unknown[] = []
    await runCompliance({
      topic: "customers/redact",
      shopDomain: SHOP,
      body: { customer: { id: 191167, email: EMAIL, phone: PHONE } },
      requestId: "req-1",
      skipSuppressions: false,
      hashSecret: SECRET,
      db,
      log: (entry) => entries.push(entry),
      deliverExport: async () => {},
      replacementToken: () => "redacted:fixed",
    })
    assert.equal(state.carts[0]?.customerEmail, null)
    assert.equal(state.carts[0]?.customerPhone, null)
    assert.equal(state.carts[0]?.customerName, null)
    assert.equal(state.carts[0]?.checkoutUrl, null)
    assert.equal(state.carts[0]?.token, "redacted:fixed")
    assert.equal(state.messages[0]?.phone, null)
    assert.equal(state.messages[0]?.email, null)
    assert.equal(state.messages[0]?.body, null)
    assert.equal(state.suppressions[0]?.email, suppressionHmac(EMAIL, SECRET))
    const logged = JSON.stringify(entries)
    assert.equal(logged.includes(EMAIL), false)
    assert.equal(logged.includes("5551234567"), false)
    assert.equal(logged.includes("key=secret-key"), false)
    assert.equal(logged.includes("191167"), false)
  }
})

test("customers/redact is idempotent and leaves a non-matching suppression", async () => {
  const { db, state } = memory({
    suppressions: [
      { id: "sup-1", email: EMAIL, storeId: "store-1" },
      { id: "sup-2", email: "other@example.com", storeId: "store-2" },
    ],
  })
  const input = {
    topic: "customers/redact",
    shopDomain: SHOP,
    body: { customer: { email: EMAIL, phone: PHONE } },
    requestId: "req-1",
    skipSuppressions: false,
    hashSecret: SECRET,
    db,
    log: () => {},
    deliverExport: async () => {},
    replacementToken: () => "redacted:fixed",
  }
  await runCompliance(input)
  const hashed = state.suppressions.find((row) => row.id === "sup-1")?.email
  await runCompliance(input)
  assert.equal(state.suppressions.find((row) => row.id === "sup-1")?.email, hashed)
  assert.equal(hashed?.startsWith("hmac1:hmac1:"), false)
  assert.equal(state.suppressions.find((row) => row.id === "sup-2")?.email, "other@example.com")
  assert.equal(state.carts[0]?.token, "redacted:fixed")
})

test("customers/redact with no match succeeds and a database error fails", async () => {
  const missing = memory({ stores: {} })
  const none = await runCompliance({
    topic: "customers/redact",
    shopDomain: SHOP,
    body: { customer: { email: EMAIL } },
    requestId: "req-1",
    skipSuppressions: false,
    hashSecret: SECRET,
    db: missing.db,
    log: () => {},
    deliverExport: async () => {},
  })
  assert.equal(none.carts, 0)
  assert.equal(missing.state.suppressions[0]?.email, EMAIL)

  const failing = memory({ cartCode: "42501" })
  await assert.rejects(
    () =>
      runCompliance({
        topic: "customers/redact",
        shopDomain: SHOP,
        body: { customer: { email: EMAIL } },
        requestId: "req-1",
        skipSuppressions: false,
        hashSecret: SECRET,
        db: failing.db,
        log: () => {},
        deliverExport: async () => {},
      }),
    (error: unknown) => error instanceof PrivacyDbError && error.code === "42501"
  )
})

test("default brand and a missing suppressions table skip that table only", async () => {
  const skipped = memory()
  let queried = false
  skipped.db.listSuppressionsByEmail = async () => {
    queried = true
    return []
  }
  await runCompliance({
    topic: "customers/redact",
    shopDomain: SHOP,
    body: { customer: { email: EMAIL } },
    requestId: "req-1",
    skipSuppressions: true,
    hashSecret: SECRET,
    db: skipped.db,
    log: () => {},
    deliverExport: async () => {},
    replacementToken: () => "redacted:fixed",
  })
  assert.equal(queried, false)
  assert.equal(skipped.state.carts[0]?.customerEmail, null)
  assert.equal(skipped.state.messages[0]?.phone, null)
  assert.equal(skipped.state.messages[0]?.email, EMAIL)
  assert.equal(skipped.state.suppressions[0]?.email, EMAIL)

  const missingTable = memory({ suppressionCode: "42P01" })
  await runCompliance({
    topic: "customers/redact",
    shopDomain: SHOP,
    body: { customer: { email: EMAIL } },
    requestId: "req-1",
    skipSuppressions: false,
    hashSecret: SECRET,
    db: missingTable.db,
    log: () => {},
    deliverExport: async () => {},
    replacementToken: () => "redacted:fixed",
  })
  assert.equal(missingTable.state.carts[0]?.customerEmail, null)
  assert.equal(missingTable.state.suppressions[0]?.email, EMAIL)
})

test("shop/redact hashes suppressions, keeps them, then deletes the store", async () => {
  const hashed = suppressionHmac(EMAIL, SECRET)
  assert.ok(hashed)
  const { db, state } = memory({
    suppressions: [
      { id: "plain", email: EMAIL, storeId: "store-1" },
      { id: "hash", email: hashed, storeId: null },
    ],
  })
  await runCompliance({
    topic: "shop/redact",
    shopDomain: SHOP,
    body: { shop_domain: SHOP },
    requestId: "req-1",
    skipSuppressions: false,
    hashSecret: SECRET,
    db,
    log: () => {},
    deliverExport: async () => {},
  })
  assert.deepEqual(state.calls, [
    "messages",
    "abandoned_carts",
    "message_templates",
    "analytics_daily",
    "stores",
  ])
  assert.equal(state.stores[SHOP], undefined)
  assert.equal(state.suppressions.length, 1)
  assert.equal(state.suppressions[0]?.id, "hash")
  assert.equal(state.suppressions[0]?.storeId, null)

  state.calls = []
  const second = await runCompliance({
    topic: "shop/redact",
    shopDomain: SHOP,
    body: {},
    requestId: "req-2",
    skipSuppressions: false,
    hashSecret: SECRET,
    db,
    log: () => {},
    deliverExport: async () => {},
  })
  assert.equal(second.carts, 0)
  assert.deepEqual(state.calls, [])
  assert.equal(state.suppressions.length, 1)
})

test("shop/redact does not delete rows when the hash secret is missing", async () => {
  const { db, state } = memory()
  await assert.rejects(
    () =>
      runCompliance({
        topic: "shop/redact",
        shopDomain: SHOP,
        body: {},
        requestId: "req-1",
        skipSuppressions: false,
        hashSecret: "",
        db,
        log: () => {},
        deliverExport: async () => {},
      }),
    (error: unknown) => error instanceof PrivacyConfigError
  )
  assert.deepEqual(state.calls, [])
  assert.equal(state.suppressions[0]?.email, EMAIL)
  assert.equal(state.stores[SHOP], "store-1")
})
