import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { cronFirstChannel, NO_MARKETING_CONSENT, runCronFirstCandidate } from "../lib/email/cron-candidate"
import { composeRecoveryEmail, type RecoveryEmailSnapshot } from "../lib/email/prepare-recovery-email"
import { sendShopifyTestMessage, type TestMessageLog } from "../lib/shopify/test-message"
import { extractCheckoutPhone, readCheckoutSmsMarketingConsent } from "../lib/whatsapp/checkout-consent"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const OPT_IN_PHONE = "+919876543210"
const SHIPPING_PHONE = "+919812345678"

/** Shape of Shopify's checkouts/create and checkouts/update sample payload (API 2026-07 / 2026-10). */
function checkoutPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    token: "123123123",
    email: "shopper@allow.test",
    buyer_accepts_marketing: false,
    phone: null,
    buyer_accepts_sms_marketing: false,
    sms_marketing_phone: null,
    billing_address: { phone: null },
    shipping_address: { phone: SHIPPING_PHONE },
    customer: { phone: null, default_address: { phone: null } },
    ...overrides,
  }
}

function customerOf(payload: Record<string, unknown>): Record<string, unknown> {
  return payload.customer as Record<string, unknown>
}

function snapshot(overrides: Partial<RecoveryEmailSnapshot> = {}): RecoveryEmailSnapshot {
  return {
    isDefaultBrand: false,
    enabled: true,
    platform: "shopify",
    phone: OPT_IN_PHONE,
    whatsappConsent: false,
    buyerAcceptsMarketing: false,
    email: "shopper@allow.test",
    suppressed: false,
    allowlistRaw: "allow.test",
    fromEmail: "news@mail.pingza.app",
    fromName: "Pingza",
    replyTo: null,
    unsubscribeSecret: "unsubscribe-test-secret",
    appUrl: "https://app.pingza.app",
    checkoutUrl: "https://shop.example/checkout",
    postalAddress: "1 Market Street, Panaji",
    storeName: "Demo",
    items: [{ title: "Mug", quantity: 1 }],
    ...overrides,
  }
}

async function runPingza(overrides: Partial<RecoveryEmailSnapshot>) {
  const previousKey = process.env.RESEND_API_KEY
  process.env.RESEND_API_KEY = "fixture-api-key"
  const sent = { email: 0, whatsapp: 0 }
  try {
    const result = await runCronFirstCandidate({
      isDefaultBrand: false,
      platform: "shopify",
      snapshot: snapshot(overrides),
      fetchImpl: async () => {
        sent.email += 1
        return new Response(JSON.stringify({ id: "email_1" }), { status: 200 })
      },
      sendWhatsApp: async () => {
        sent.whatsapp += 1
      },
    })
    return { result, sent }
  } finally {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = previousKey
  }
}

test("checkout SMS consent reads only a real buyer_accepts_sms_marketing boolean", () => {
  assert.equal(readCheckoutSmsMarketingConsent(checkoutPayload({ buyer_accepts_sms_marketing: true })), true)
  assert.equal(readCheckoutSmsMarketingConsent(checkoutPayload({ buyer_accepts_sms_marketing: false })), false)
  assert.equal(readCheckoutSmsMarketingConsent({ token: "t" }), undefined)
  assert.equal(readCheckoutSmsMarketingConsent(checkoutPayload({ buyer_accepts_sms_marketing: "true" })), undefined)
  assert.equal(readCheckoutSmsMarketingConsent(checkoutPayload({ buyer_accepts_sms_marketing: null })), undefined)
})

test("Pingza prefers the SMS opt-in phone and contact phones; shipping phone is the last fallback", () => {
  const optedIn = checkoutPayload({
    buyer_accepts_sms_marketing: true,
    sms_marketing_phone: OPT_IN_PHONE,
    billing_address: { phone: "+919800000001" },
  })
  assert.equal(extractCheckoutPhone(optedIn, customerOf(optedIn), { isDefaultBrand: false }), OPT_IN_PHONE)

  const contact = checkoutPayload({ phone: "+919800000002" })
  assert.equal(extractCheckoutPhone(contact, customerOf(contact), { isDefaultBrand: false }), "+919800000002")

  const customerPhone = checkoutPayload({ customer: { phone: "+919800000003" } })
  assert.equal(
    extractCheckoutPhone(customerPhone, customerOf(customerPhone), { isDefaultBrand: false }),
    "+919800000003"
  )

  const shippingOnly = checkoutPayload()
  assert.equal(extractCheckoutPhone(shippingOnly, customerOf(shippingOnly), { isDefaultBrand: false }), SHIPPING_PHONE)
})

test("CartRenew phone order is unchanged: shipping phone first", () => {
  const payload = checkoutPayload({
    phone: "+919800000002",
    sms_marketing_phone: OPT_IN_PHONE,
    billing_address: { phone: "+919800000001" },
    customer: { phone: "+919800000003", default_address: { phone: "+919800000004" } },
  })
  assert.equal(extractCheckoutPhone(payload, customerOf(payload), { isDefaultBrand: true }), SHIPPING_PHONE)

  const noShipping = { ...payload, shipping_address: { phone: null } }
  assert.equal(extractCheckoutPhone(noShipping, customerOf(noShipping), { isDefaultBrand: true }), "+919800000003")

  const onlyDefault = checkoutPayload({ shipping_address: null, customer: { default_address: { phone: "+919800000004" } } })
  assert.equal(extractCheckoutPhone(onlyDefault, customerOf(onlyDefault), { isDefaultBrand: true }), "+919800000004")
})

test("consent true sends WhatsApp", async () => {
  assert.equal(
    cronFirstChannel({
      isDefaultBrand: false,
      platform: "shopify",
      phone: OPT_IN_PHONE,
      whatsappConsent: true,
      emailConsent: false,
    }),
    "whatsapp"
  )

  const { result, sent } = await runPingza({ whatsappConsent: true })
  assert.deepEqual(result, { channel: "whatsapp" })
  assert.deepEqual(sent, { email: 0, whatsapp: 1 })
})

test("consent false or missing never sends WhatsApp; email consent falls back to email", async () => {
  for (const whatsappConsent of [false, readCheckoutSmsMarketingConsent({}) === true]) {
    assert.equal(
      cronFirstChannel({
        isDefaultBrand: false,
        platform: "shopify",
        phone: OPT_IN_PHONE,
        whatsappConsent,
        emailConsent: true,
      }),
      "email"
    )

    const { result, sent } = await runPingza({ whatsappConsent, buyerAcceptsMarketing: true })
    assert.deepEqual(result, { channel: "email" })
    assert.deepEqual(sent, { email: 1, whatsapp: 0 })
  }
})

test("neither consent sends nothing and is skipped as no_marketing_consent", async () => {
  assert.equal(NO_MARKETING_CONSENT, "no_marketing_consent")
  assert.equal(
    cronFirstChannel({
      isDefaultBrand: false,
      platform: "shopify",
      phone: OPT_IN_PHONE,
      whatsappConsent: false,
      emailConsent: false,
    }),
    "skip_no_consent"
  )

  const { result, sent } = await runPingza({ whatsappConsent: false, buyerAcceptsMarketing: false })
  assert.deepEqual(result, { channel: "none", reason: NO_MARKETING_CONSENT })
  assert.deepEqual(sent, { email: 0, whatsapp: 0 })
})

test("a shipping phone without consent sends nothing", async () => {
  const payload = checkoutPayload()
  const phone = extractCheckoutPhone(payload, customerOf(payload), { isDefaultBrand: false })
  const whatsappConsent = readCheckoutSmsMarketingConsent(payload) === true
  assert.equal(phone, SHIPPING_PHONE)
  assert.equal(whatsappConsent, false)

  const { result, sent } = await runPingza({ phone, whatsappConsent, buyerAcceptsMarketing: false })
  assert.deepEqual(result, { channel: "none", reason: NO_MARKETING_CONSENT })
  assert.deepEqual(sent, { email: 0, whatsapp: 0 })
})

test("email gate treats an opted-out sendable phone as not WhatsApp-able", () => {
  const withoutConsent = composeRecoveryEmail(snapshot({ whatsappConsent: false, buyerAcceptsMarketing: true }))
  assert.equal(withoutConsent.ok, true)

  const withConsent = composeRecoveryEmail(snapshot({ whatsappConsent: true, buyerAcceptsMarketing: true }))
  assert.deepEqual(withConsent, { ok: false, reason: "whatsapp_possible" })
})

test("CartRenew and WooCommerce channel choice ignores checkout consent", () => {
  for (const isDefaultBrand of [true, false]) {
    const platform = isDefaultBrand ? "shopify" : "woocommerce"
    assert.equal(
      cronFirstChannel({ isDefaultBrand, platform, phone: OPT_IN_PHONE, whatsappConsent: false, emailConsent: false }),
      "whatsapp"
    )
    assert.equal(
      cronFirstChannel({ isDefaultBrand, platform, phone: null, whatsappConsent: true, emailConsent: true }),
      "skip_missing_phone"
    )
  }
})

test("CartRenew does not write or select the SMS consent column", () => {
  const route = fs.readFileSync(path.join(root, "app/api/webhooks/shopify/route.ts"), "utf8")
  const writes = route.match(/smsMarketingConsent: [^\r\n]+/g) ?? []
  assert.equal(writes.length, 2)
  for (const line of writes) {
    assert.match(line, /^smsMarketingConsent: brand\.isDefault \? undefined : readCheckoutSmsMarketingConsent\(payload\),$/)
  }

  const dispatch = fs.readFileSync(path.join(root, "lib/services/recovery-dispatch.ts"), "utf8")
  assert.match(dispatch, /const CART_CONSENT_COLUMNS = brand\.isDefault \? '' :/)
  assert.match(dispatch, /const RETRY_CART_CONSENT_COLUMNS = brand\.isDefault \? '' :/)
})

test("test message sends without any cart or consent", async () => {
  const log: TestMessageLog = {
    async reserve() {
      return "row-1"
    },
    async earliestIdsSince() {
      return ["row-1"]
    },
    async release() {},
    async finish() {},
  }
  let sends = 0
  const outcome = await sendShopifyTestMessage({
    storeId: "store-1",
    shop: "demo-store.myshopify.com",
    e164: "+447700900123",
    log,
    send: async () => {
      sends += 1
      return { success: true, messageId: "wamid.test" }
    },
  })
  assert.equal(outcome.status, "sent")
  assert.equal(sends, 1)

  for (const file of ["lib/shopify/test-message.ts", "app/api/shopify/test-message/route.ts"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8")
    assert.doesNotMatch(source, /sms_marketing|checkout-consent|cronFirstChannel/)
  }
})
