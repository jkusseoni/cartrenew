import assert from "node:assert/strict"
import test from "node:test"

import { sanitizeCustomerText, storedCustomerError } from "../lib/privacy/sanitize-customer-text"

test("stored errors drop phones, emails, and checkout key urls", () => {
  const input = [
    "send failed for buyer@example.com",
    "phone +1 (555) 123-4567",
    "link https://demo.myshopify.com/checkouts/ac/1?key=abc123&token=1",
    "plain https://example.com/ok",
    "status 404",
  ].join(" ")
  const output = sanitizeCustomerText(input)
  assert.equal(output.includes("buyer@example.com"), false)
  assert.equal(output.includes("555"), false)
  assert.equal(output.includes("key=abc123"), false)
  assert.equal(output.includes("https://example.com/ok"), true)
  assert.equal(output.includes("404"), true)
  assert.equal(output.includes("[redacted-email]"), true)
  assert.equal(output.includes("[redacted-phone]"), true)
  assert.equal(output.includes("[redacted-url]"), true)
})

test("stored errors still redact configured secrets", () => {
  const previous = process.env.SUPPRESSION_HASH_SECRET
  process.env.SUPPRESSION_HASH_SECRET = "suppression-test-secret"
  try {
    const output = storedCustomerError("Bearer abcdefgh token suppression-test-secret")
    assert.equal(output.includes("abcdefgh"), false)
    assert.equal(output.includes("suppression-test-secret"), false)
  } finally {
    if (previous === undefined) delete process.env.SUPPRESSION_HASH_SECRET
    else process.env.SUPPRESSION_HASH_SECRET = previous
  }
})
