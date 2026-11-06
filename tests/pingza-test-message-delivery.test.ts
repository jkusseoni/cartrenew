import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  plainTestDeliveryError,
  TEST_MESSAGE_NOT_DELIVERED,
  TEST_MESSAGE_STILL_PENDING,
  TEST_MESSAGE_TRY_ANOTHER_NUMBER,
  testDeliveryView,
} from "../lib/shopify/test-message-config"
import { nextTestDeliveryPayload } from "../lib/whatsapp-status"
import { optOutForwardDecision, statusForwardDecision } from "../lib/whatsapp/opt-out-forward"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8")
const URL_OK = "https://pingza.test/api/whatsapp/webhook"

const base = {
  isDefaultBrand: true,
  configuredUrl: URL_OK,
  signatureVerified: true,
  signatureHeader: "sha256=" + "a".repeat(64),
  alreadyForwarded: false,
  unknownStatusCount: 1,
}

test("statusForwardDecision forwards only verified payloads with an unknown wamid", () => {
  assert.deepEqual(statusForwardDecision(base), { forward: true, url: URL_OK })
  assert.deepEqual(statusForwardDecision({ ...base, unknownStatusCount: 0 }), {
    forward: false,
    reason: "no_unknown_status",
  })
})

test("statusForwardDecision keeps the loop guard, signature and env checks", () => {
  assert.deepEqual(statusForwardDecision({ ...base, alreadyForwarded: true }), { forward: false, reason: "already_forwarded" })
  assert.deepEqual(statusForwardDecision({ ...base, signatureVerified: false }), { forward: false, reason: "signature_unverified" })
  assert.deepEqual(statusForwardDecision({ ...base, signatureHeader: null }), { forward: false, reason: "signature_header_missing" })
  assert.deepEqual(statusForwardDecision({ ...base, configuredUrl: undefined }), { forward: false, reason: "env_unset" })
  assert.deepEqual(statusForwardDecision({ ...base, configuredUrl: "http://insecure.test" }), { forward: false, reason: "invalid_url" })
  assert.deepEqual(statusForwardDecision({ ...base, isDefaultBrand: false }), { forward: false, reason: "not_cartrenew" })
})

test("opt-out forwarding is unchanged by the shared guards", () => {
  const stop = {
    entry: [{ changes: [{ value: { messages: [{ from: "447700900123", type: "text", text: { body: "STOP" } }] } }] }],
  }
  assert.deepEqual(optOutForwardDecision({ ...base, body: stop }), { forward: true, url: URL_OK })
  assert.deepEqual(optOutForwardDecision({ ...base, body: { entry: [] } }), { forward: false, reason: "no_opt_out_keyword" })
  assert.deepEqual(optOutForwardDecision({ ...base, isDefaultBrand: false, body: stop }), { forward: false, reason: "not_cartrenew" })
})

test("nextTestDeliveryPayload moves forward and never downgrades", () => {
  const at = "2026-11-06T10:00:00.000Z"
  const start = { kind: "shopify_test_message", phone: "*******1691" }

  const sent = nextTestDeliveryPayload(start, { status: "sent", error: null }, at)
  assert.deepEqual(sent, { ...start, delivery_status: "sent", delivery_error: null, updated_at: at })

  const delivered = nextTestDeliveryPayload(sent, { status: "delivered", error: null }, at)
  assert.equal(delivered?.delivery_status, "delivered")

  assert.equal(nextTestDeliveryPayload(delivered, { status: "sent", error: null }, at), null, "late sent must not overwrite delivered")
  assert.equal(nextTestDeliveryPayload(delivered, { status: "delivered", error: null }, at), null)

  const failed = nextTestDeliveryPayload(sent, { status: "failed", error: "131049: Message not delivered" }, at)
  assert.equal(failed?.delivery_status, "failed")
  assert.equal(failed?.delivery_error, "131049: Message not delivered")

  assert.equal(nextTestDeliveryPayload(null, { status: "failed", error: null }, at)?.delivery_error, "unknown")
  assert.equal(start.hasOwnProperty("delivery_status"), false, "input is not mutated")
})

test("plainTestDeliveryError maps the marketing-limit codes to a plain sentence", () => {
  assert.equal(plainTestDeliveryError("131049: This message was not delivered to maintain healthy ecosystem engagement."), TEST_MESSAGE_NOT_DELIVERED)
  assert.equal(plainTestDeliveryError("131026: Message undeliverable"), "Message undeliverable")
  assert.equal(plainTestDeliveryError(null), "WhatsApp could not deliver this message.")
})

test("card text never claims delivery Meta has not reported", () => {
  assert.deepEqual(testDeliveryView(null, null), { state: "checking" })
  assert.deepEqual(testDeliveryView("sent", null), { state: "checking" })
  assert.deepEqual(testDeliveryView("sent", null, true), { state: "unconfirmed", text: TEST_MESSAGE_STILL_PENDING })
  assert.deepEqual(testDeliveryView("delivered", null), { state: "delivered", text: "Delivered to WhatsApp." })
  assert.equal(testDeliveryView("read", null).state, "delivered")
  const failed = testDeliveryView("failed", "131049: x")
  assert.equal(failed.state, "failed")
  assert.ok("text" in failed && failed.text.includes(TEST_MESSAGE_NOT_DELIVERED) && failed.text.includes(TEST_MESSAGE_TRY_ANOTHER_NUMBER))
})

test("status route is Pingza-only, session-scoped and never returns a phone", () => {
  const src = read("app/api/shopify/test-message/status/route.ts")
  assert.match(src, /if \(brand\.isDefault\)[\s\S]{0,80}status: 404/)
  assert.match(src, /getBearerToken/)
  assert.match(src, /verifySessionToken/)
  assert.match(src, /\.eq\("merchant_id", storeId\)/)
  assert.match(src, /\.eq\("cart_id", TEST_MESSAGE_LOG_CART_ID\)/)
  assert.match(src, /\.select\("payload"\)/)
  assert.doesNotMatch(src, /phone:/)
})

test("status sync only writes delivery when the stored status is unchanged", () => {
  const src = read("lib/services/whatsapp-status-sync.ts")
  assert.match(src, /payload->>delivery_status/)
  assert.match(src, /nextTestDeliveryPayload/)
})

test("card polls the status endpoint and stops on unmount", () => {
  const src = read("components/shopify/ShopifyTestMessageCard.tsx")
  assert.match(src, /\/api\/shopify\/test-message\/status\?id=/)
  assert.match(src, /cancelled = true/)
  assert.match(src, /clearTimeout/)
  assert.doesNotMatch(src, /Test message sent to/)
})

test("webhook route forwards unknown statuses only from the CartRenew deployment", () => {
  const src = read("app/api/whatsapp/webhook/route.ts")
  assert.match(src, /if \(brand\.isDefault\) \{[\s\S]*statusForwardDecision/)
  assert.match(src, /unknownStatusCount: counts\.unknown_message/)
})
