import assert from "node:assert/strict"
import test from "node:test"

import { runCronFirstCandidate } from "../lib/email/cron-candidate"
import type { RecoveryEmailSnapshot } from "../lib/email/prepare-recovery-email"

function snapshot(overrides: Partial<RecoveryEmailSnapshot> = {}): RecoveryEmailSnapshot {
  return {
    isDefaultBrand: false,
    enabled: true,
    platform: "shopify",
    phone: null,
    buyerAcceptsMarketing: true,
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

test("cron first attempt emails once without a phone, uses WhatsApp when a phone exists, and sends nothing without consent", async () => {
  const previousKey = process.env.RESEND_API_KEY
  process.env.RESEND_API_KEY = "fixture-api-key"
  let fetches = 0
  let whatsapp = 0
  const fetchImpl = async () => {
    fetches += 1
    return new Response(JSON.stringify({ id: "email_1" }), { status: 200 })
  }
  const sendWhatsApp = async () => {
    whatsapp += 1
  }

  try {
    const emailed = await runCronFirstCandidate({
      isDefaultBrand: false,
      platform: "shopify",
      snapshot: snapshot(),
      fetchImpl,
      sendWhatsApp,
    })
    assert.deepEqual(emailed, { channel: "email" })
    assert.equal(fetches, 1)
    assert.equal(whatsapp, 0)

    fetches = 0
    whatsapp = 0
    const messaged = await runCronFirstCandidate({
      isDefaultBrand: false,
      platform: "shopify",
      snapshot: snapshot({ phone: "+919876543210" }),
      fetchImpl,
      sendWhatsApp,
    })
    assert.deepEqual(messaged, { channel: "whatsapp" })
    assert.equal(fetches, 0)
    assert.equal(whatsapp, 1)

    fetches = 0
    whatsapp = 0
    const skipped = await runCronFirstCandidate({
      isDefaultBrand: false,
      platform: "shopify",
      snapshot: snapshot({ buyerAcceptsMarketing: false }),
      fetchImpl,
      sendWhatsApp,
    })
    assert.deepEqual(skipped, { channel: "none", reason: "no_consent" })
    assert.equal(fetches, 0)
    assert.equal(whatsapp, 0)
  } finally {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = previousKey
  }
})
