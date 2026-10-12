import assert from "node:assert/strict"
import test from "node:test"

import { summarizeCheckoutConsent } from "../lib/email/checkout-consent-log"

test("checkout consent log keeps field names and drops contact details", () => {
  const summary = summarizeCheckoutConsent(
    {
      token: "secret-checkout-token",
      email: "shopper@example.com",
      phone: "+919876543210",
      buyer_accepts_marketing: false,
      customer: {
        first_name: "Ada",
        email: "shopper@example.com",
        accepts_marketing: true,
        email_marketing_consent: {
          state: "subscribed",
          opt_in_level: "single_opt_in",
          consent_updated_at: "2026-10-12T00:00:00Z",
        },
      },
    },
    { topic: "checkouts/update", apiVersion: "2024-10" }
  )

  assert.equal(summary.topic, "checkouts/update")
  assert.equal(summary.apiVersion, "2024-10")
  assert.deepEqual(summary.topLevelKeys, [
    "buyer_accepts_marketing",
    "customer",
    "email",
    "phone",
    "token",
  ])
  assert.equal(summary.consentFields.buyer_accepts_marketing, false)
  assert.equal(summary.consentFields["customer.accepts_marketing"], true)
  assert.deepEqual(summary.consentFields["customer.email_marketing_consent"], {
    state: "subscribed",
    opt_in_level: "single_opt_in",
    consent_updated_at: "2026-10-12T00:00:00Z",
  })

  const serialized = JSON.stringify(summary)
  assert.equal(serialized.includes("shopper@example.com"), false)
  assert.equal(serialized.includes("919876543210"), false)
  assert.equal(serialized.includes("Ada"), false)
  assert.equal(serialized.includes("secret-checkout-token"), false)
})
