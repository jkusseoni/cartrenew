import assert from "node:assert/strict"
import test from "node:test"

import { whatsAppEngineStatus } from "../lib/services/whatsapp-engine-status"

const META_TOKEN = "WHATSAPP_ACCESS_TOKEN"
const META_PHONE = "WHATSAPP_PHONE_NUMBER_ID"
const TWILIO_SID = "TWILIO_ACCOUNT_SID"
const TWILIO_TOKEN = "TWILIO_AUTH_TOKEN"
const TWILIO_FROM = "TWILIO_WHATSAPP_NUMBER"

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const previous = new Map<string, string | undefined>()
  for (const key of Object.keys(values)) {
    previous.set(key, process.env[key])
    const next = values[key]
    if (next === undefined) delete process.env[key]
    else process.env[key] = next
  }
  try {
    run()
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function assertNoSecrets(status: { ok: boolean; bypass: boolean; label: string }, secrets: string[]) {
  const encoded = JSON.stringify(status)
  for (const secret of secrets) {
    assert.equal(encoded.includes(secret), false)
  }
  assert.equal(encoded.toLowerCase().includes("twilio"), false)
  assert.equal(encoded.includes(META_TOKEN), false)
  assert.equal(encoded.includes(META_PHONE), false)
}

test("CartRenew WhatsApp status stays Bypass Mode or Active Mode", () => {
  withEnv(
    {
      [META_TOKEN]: "meta-access-token-present",
      [META_PHONE]: "109876543210",
      [TWILIO_SID]: undefined,
      [TWILIO_TOKEN]: undefined,
      [TWILIO_FROM]: undefined,
    },
    () => {
      assert.deepEqual(whatsAppEngineStatus(true), {
        ok: true,
        bypass: true,
        label: "Bypass Mode",
      })
    }
  )

  withEnv(
    {
      [META_TOKEN]: undefined,
      [META_PHONE]: undefined,
      [TWILIO_SID]: "AC1234567890abcdef1234567890abcd",
      [TWILIO_TOKEN]: "twilio-auth-token-present",
      [TWILIO_FROM]: "+14155550123",
    },
    () => {
      assert.deepEqual(whatsAppEngineStatus(true), {
        ok: true,
        bypass: false,
        label: "Active Mode",
      })
    }
  )
})

test("Pingza WhatsApp status follows Meta credentials", () => {
  const metaToken = "meta-access-token-present"
  const metaPhone = "109876543210"

  withEnv(
    {
      [META_TOKEN]: metaToken,
      [META_PHONE]: metaPhone,
      [TWILIO_SID]: undefined,
      [TWILIO_TOKEN]: undefined,
      [TWILIO_FROM]: undefined,
    },
    () => {
      const status = whatsAppEngineStatus(false)
      assert.deepEqual(status, { ok: true, bypass: false, label: "Connected" })
      assertNoSecrets(status, [metaToken, metaPhone])
    }
  )

  withEnv(
    {
      [META_TOKEN]: undefined,
      [META_PHONE]: metaPhone,
      [TWILIO_SID]: "AC1234567890abcdef1234567890abcd",
      [TWILIO_TOKEN]: "twilio-auth-token-present",
      [TWILIO_FROM]: "+14155550123",
    },
    () => {
      const status = whatsAppEngineStatus(false)
      assert.deepEqual(status, { ok: false, bypass: true, label: "Not connected" })
      assertNoSecrets(status, ["twilio-auth-token-present", metaPhone])
    }
  )
})
