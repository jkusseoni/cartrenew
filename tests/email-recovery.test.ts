import assert from "node:assert/strict"
import crypto from "node:crypto"
import test from "node:test"

import { readBuyerAcceptsMarketing, readCheckoutMarketingConsent } from "../lib/email/buyer-consent"
import {
  decideRecoveryEmail,
  parseEmailAllowlist,
  type EmailGateInput,
} from "../lib/email/recovery-gate"
import {
  classifyResendEvent,
  sendResendEmail,
  verifyResendWebhook,
} from "../lib/email/resend"
import { recoveryEmailHeaders } from "../lib/email/template"
import { suppressionInsert } from "../lib/email/suppression"
import {
  readUnsubscribeToken,
  signUnsubscribeToken,
} from "../lib/email/unsubscribe-token"

const NOW = Date.parse("2026-10-11T12:00:00.000Z")

function gate(overrides: Partial<EmailGateInput> = {}) {
  return decideRecoveryEmail({
    isDefaultBrand: false,
    enabled: true,
    platform: "shopify",
    whatsappSendable: false,
    buyerAcceptsMarketing: true,
    email: "Shopper@Example.com",
    suppressed: false,
    allowlist: { mode: "all" },
    senderConfigured: true,
    unsubscribeConfigured: true,
    appUrl: "https://app.pingza.app",
    checkoutUrl: "https://shop.example/checkout",
    postalAddress: "1 Market Street, Panaji",
    ...overrides,
  })
}

test("channel rule covers phone, consent, brand, platform, and config", () => {
  assert.equal(gate().ok, true)
  if (gate().ok) assert.equal(gate().ok && (gate() as { email: string }).email, "shopper@example.com")

  assert.deepEqual(gate({ whatsappSendable: true }), { ok: false, reason: "whatsapp_possible" })
  assert.deepEqual(gate({ isDefaultBrand: true }), { ok: false, reason: "default_brand" })
  assert.deepEqual(gate({ enabled: false }), { ok: false, reason: "disabled" })
  assert.deepEqual(gate({ platform: "woocommerce" }), { ok: false, reason: "woocommerce" })
  assert.deepEqual(gate({ buyerAcceptsMarketing: false }), { ok: false, reason: "no_consent" })
  assert.deepEqual(gate({ email: "not-an-email" }), { ok: false, reason: "invalid_email" })
  assert.deepEqual(gate({ suppressed: true }), { ok: false, reason: "suppressed" })
  assert.deepEqual(gate({ postalAddress: "  " }), { ok: false, reason: "missing_postal" })
  assert.deepEqual(gate({ postalAddress: null }), { ok: false, reason: "missing_postal" })
  assert.deepEqual(gate({ checkoutUrl: "http://shop.example" }), { ok: false, reason: "missing_checkout" })
})

test("allowlist empty sends nothing, star allows all, and domains match", () => {
  assert.deepEqual(parseEmailAllowlist(""), { mode: "unset" })
  assert.deepEqual(parseEmailAllowlist(null), { mode: "unset" })
  assert.deepEqual(parseEmailAllowlist("*"), { mode: "all" })
  assert.deepEqual(gate({ allowlist: { mode: "unset" } }), { ok: false, reason: "allowlist_empty" })

  const list = parseEmailAllowlist("other@example.com, Shop.Test")
  assert.equal(gate({ allowlist: list, email: "a@shop.test" }).ok, true)
  assert.deepEqual(gate({ allowlist: list, email: "nope@elsewhere.test" }), {
    ok: false,
    reason: "allowlist",
  })
})

test("unsubscribe token rejects tampering and does not expire", () => {
  const secret = "unsubscribe-test-secret"
  const token = signUnsubscribeToken("Buyer@Example.com", secret)
  assert.deepEqual(readUnsubscribeToken(token, secret), {
    ok: true,
    email: "buyer@example.com",
  })

  const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`
  assert.equal(readUnsubscribeToken(tampered, secret).ok, false)

  const expiredBody = Buffer.from(
    JSON.stringify({ e: "buyer@example.com", exp: NOW - 31 * 24 * 60 * 60 * 1000 })
  ).toString("base64url")
  const expiredSig = crypto.createHmac("sha256", secret).update(expiredBody).digest("base64url")
  assert.deepEqual(readUnsubscribeToken(`${expiredBody}.${expiredSig}`, secret), {
    ok: true,
    email: "buyer@example.com",
  })
})

test("suppression insert lowercases the address and does nothing on conflict", () => {
  const write = suppressionInsert("Buyer@Example.com", "unsubscribed")
  if (!write) throw new Error("expected a suppression write")
  assert.equal(write.row.email, "buyer@example.com")
  assert.equal(write.row.reason, "unsubscribed")
  assert.deepEqual(write.options, { onConflict: "email", ignoreDuplicates: true })
  assert.equal(suppressionInsert("not-an-email", "bounced"), null)
})

test("recovery email sets one-click unsubscribe headers", async () => {
  const headers = recoveryEmailHeaders("https://app.pingza.app/unsubscribe/token")
  assert.equal(headers["List-Unsubscribe"], "<https://app.pingza.app/unsubscribe/token>")
  assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click")

  let body = ""
  const result = await sendResendEmail(
    {
      from: "Pingza <news@mail.pingza.app>",
      to: "shopper@example.com",
      replyTo: null,
      subject: "You left something in your cart",
      html: "<p>Hi</p>",
      text: "Hi",
      unsubscribeUrl: "https://app.pingza.app/unsubscribe/token",
      apiKey: "fixture-api-key",
    },
    async (_url, init) => {
      body = String(init?.body ?? "")
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 })
    }
  )
  assert.deepEqual(result, { ok: true, id: "email_1" })
  assert.match(body, /List-Unsubscribe/)
  assert.match(body, /List-Unsubscribe=One-Click/)
  assert.match(body, /"text":"Hi"/)
})

test("resend webhook signature accepts a valid signature and rejects a bad one", () => {
  const secret = Buffer.from("fixture-webhook-secret").toString("base64")
  const payload = JSON.stringify({ type: "email.delivered" })
  const id = "msg_1"
  const timestamp = String(Math.floor(NOW / 1000))
  const key = Buffer.from(secret, "base64")
  const signature = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64")

  assert.equal(
    verifyResendWebhook(payload, { id, timestamp, signature: `v1,${signature}` }, `whsec_${secret}`, NOW),
    true
  )
  assert.equal(
    verifyResendWebhook(payload, { id, timestamp, signature: `v1,${signature}x` }, `whsec_${secret}`, NOW),
    false
  )
  assert.equal(
    verifyResendWebhook(
      payload,
      { id, timestamp: String(Math.floor(NOW / 1000) - 600), signature: `v1,${signature}` },
      `whsec_${secret}`,
      NOW
    ),
    false
  )
})

test("resend events suppress only a hard bounce or a complaint", () => {
  assert.equal(
    classifyResendEvent({
      type: "email.bounced",
      data: { email_id: "email_1", to: ["A@Example.com"], bounce: { type: "Permanent" } },
    }).kind,
    "hard_bounce"
  )
  assert.equal(
    classifyResendEvent({
      type: "email.bounced",
      data: { to: ["a@example.com"], bounce: { type: "Temporary" } },
    }).kind,
    "ignore"
  )
  assert.equal(classifyResendEvent({ type: "email.complained", data: { to: ["a@example.com"] } }).kind, "complaint")
  assert.equal(classifyResendEvent({ type: "email.opened", data: { email_id: "email_9" } }).kind, "opened")
})

test("checkout consent uses buyer_accepts_marketing or customer.accepts_marketing", () => {
  assert.equal(
    readBuyerAcceptsMarketing({
      buyer_accepts_marketing: false,
      customer: { accepts_marketing: true },
    }),
    true
  )
  assert.equal(readCheckoutMarketingConsent({
    buyer_accepts_marketing: false,
    customer: { accepts_marketing: true },
  }).source, "customer.accepts_marketing")

  assert.equal(readBuyerAcceptsMarketing({ buyer_accepts_marketing: true }), true)
  assert.equal(
    readCheckoutMarketingConsent({ buyer_accepts_marketing: true }).source,
    "buyer_accepts_marketing"
  )

  assert.equal(
    readBuyerAcceptsMarketing({
      buyer_accepts_marketing: false,
      customer: { accepts_marketing: false },
    }),
    false
  )
  assert.equal(readBuyerAcceptsMarketing({}), undefined)
  assert.equal(readCheckoutMarketingConsent({}).source, null)

  assert.equal(
    readBuyerAcceptsMarketing({
      buyer_accepts_marketing: "true",
      customer: { accepts_marketing: "true" },
    }),
    undefined
  )
  assert.equal(
    readBuyerAcceptsMarketing({
      buyer_accepts_marketing: false,
      customer: { accepts_marketing: "true" },
    }),
    false
  )

  assert.equal(
    readBuyerAcceptsMarketing({
      buyer_accepts_marketing: true,
      customer: { email: "shopper@example.com" },
    }),
    true
  )
  assert.equal(
    readBuyerAcceptsMarketing({
      buyer_accepts_marketing: false,
      customer: {},
    }),
    false
  )
  assert.equal(readBuyerAcceptsMarketing({ customer: { first_name: "Ada" } }), undefined)

  assert.equal(
    readBuyerAcceptsMarketing({
      buyer_accepts_marketing: false,
      customer: {},
      payload: { customer: { accepts_marketing: true } },
    }),
    true
  )
  assert.equal(
    readBuyerAcceptsMarketing({
      buyer_accepts_marketing: false,
      customer: { accepts_marketing: false },
      payload: { customer: { accepts_marketing: true } },
    }),
    false
  )
})
