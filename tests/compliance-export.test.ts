import assert from "node:assert/strict"
import test from "node:test"

import { runCompliance, type PrivacyDb } from "../lib/privacy/compliance"
import { PrivacyConfigError } from "../lib/privacy/compliance-errors"
import { deliverPrivacyExportEmail } from "../lib/privacy/export-mail"

const EMAIL = "buyer@example.com"
const PHONE = "+15551234567"
const CHECKOUT = "https://demo.myshopify.com/checkouts/1?key=secret-key"

function exportDb(): PrivacyDb {
  return {
    async findStoreId() {
      return "store-1"
    },
    async listCarts() {
      return [
        {
          id: "cart-1",
          customerEmail: EMAIL,
          customerPhone: PHONE,
          customerName: "Buyer",
          checkoutUrl: CHECKOUT,
          status: "pending",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]
    },
    async anonymizeCart() {},
    async listMessagesForCarts() {
      return [
        {
          id: "msg-1",
          cartId: "cart-1",
          phone: PHONE,
          email: EMAIL,
          body: "",
          templateName: "abandoned_cart_email",
          status: "sent",
          createdAt: "2026-01-01T00:00:00.000Z",
          sentAt: null,
        },
      ]
    },
    async anonymizeMessages() {
      return 0
    },
    async listSuppressionsForStore() {
      return []
    },
    async listSuppressionsByEmail() {
      return [{ id: "sup-1", email: EMAIL, storeId: "store-1" }]
    },
    async updateSuppression() {
      return "updated"
    },
    async deleteSuppression() {},
    async deleteStoreScoped() {},
    async deleteStore() {},
  }
}

test("data_request export keeps contact details out of the log", async () => {
  let delivered: { requestId: string; body: string } | null = null
  const entries: unknown[] = []
  await runCompliance({
    topic: "customers/data_request",
    shopDomain: "demo.myshopify.com",
    body: { customer: { id: 191167, email: EMAIL, phone: PHONE }, data_request: { id: 9999 } },
    requestId: "fallback",
    skipSuppressions: false,
    hashSecret: "suppression-test-secret",
    db: exportDb(),
    log: (entry) => entries.push(entry),
    deliverExport: async (input) => {
      delivered = input
    },
  })

  assert.ok(delivered)
  const sent = delivered as { requestId: string; body: string }
  assert.equal(sent.requestId, "9999")
  const parsed = JSON.parse(sent.body) as {
    email_suppressed: boolean
    carts: { customer_email: string; messages: Record<string, string>[] }[]
  }
  assert.equal(parsed.email_suppressed, true)
  assert.equal(parsed.carts[0]?.customer_email, EMAIL)
  assert.equal("body" in (parsed.carts[0]?.messages[0] ?? {}), false)

  const logged = JSON.stringify(entries)
  assert.equal(logged.includes(EMAIL), false)
  assert.equal(logged.includes(PHONE), false)
  assert.equal(logged.includes("key=secret-key"), false)
  assert.equal(logged.includes("191167"), false)
  assert.equal(logged.includes("9999"), true)
})

test("data_request does not email when the shop is unknown", async () => {
  let called = false
  const result = await runCompliance({
    topic: "customers/data_request",
    shopDomain: "missing.myshopify.com",
    body: { customer: { email: EMAIL } },
    requestId: "req-1",
    skipSuppressions: false,
    hashSecret: "suppression-test-secret",
    db: { ...exportDb(), async findStoreId() { return null } },
    log: () => {},
    deliverExport: async () => {
      called = true
    },
  })
  assert.equal(called, false)
  assert.equal(result.carts, 0)
})

test("export delivery failure is a retryable error and hides the provider body", async () => {
  await assert.rejects(
    () =>
      deliverPrivacyExportEmail(
        {
          requestId: "9999",
          body: "{}",
          recipient: "support@pingza.app",
          from: "Pingza <mail@pingza.app>",
          apiKey: "re_test",
        },
        async () => new Response(JSON.stringify({ message: EMAIL }), { status: 502 })
      ),
    (error: unknown) => {
      assert.ok(error instanceof PrivacyConfigError)
      assert.equal(error.message.includes(EMAIL), false)
      return true
    }
  )

  let subject = ""
  await deliverPrivacyExportEmail(
    {
      requestId: "9999",
      body: "{}",
      recipient: "support@pingza.app",
      from: "Pingza <mail@pingza.app>",
      apiKey: "re_test",
    },
    async (_url, init) => {
      const payload = JSON.parse(String(init?.body)) as { subject: string }
      subject = payload.subject
      return new Response("{}", { status: 200 })
    }
  )
  assert.equal(subject, "9999")
})
