import assert from "node:assert/strict"
import test from "node:test"

import { redactSecrets } from "../lib/services/redact-secrets"

test("redacts a bearer token and an EAA token from an error string", () => {
  const fake = "EAAfakeTokenValue123"
  const previous = process.env.WHATSAPP_ACCESS_TOKEN
  process.env.WHATSAPP_ACCESS_TOKEN = fake

  try {
    const input = `Headers.append: "Bearer ${fake}" is an invalid header value`
    const output = redactSecrets(input)

    assert.equal(output.includes(fake), false)
    assert.match(output, /\[REDACTED\]/)
    assert.match(output, /invalid header value/)
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN
    else process.env.WHATSAPP_ACCESS_TOKEN = previous
  }
})
