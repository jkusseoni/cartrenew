import crypto from "crypto"

type TokenPayload = { e: string }

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function decode(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8")
  } catch {
    return null
  }
}

/** Signed email address. The link does not expire. */
export function signUnsubscribeToken(email: string, secret: string): string {
  const payload: TokenPayload = { e: email.trim().toLowerCase() }
  const body = encode(JSON.stringify(payload))
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${sig}`
}

export function readUnsubscribeToken(
  token: string,
  secret: string
): { ok: true; email: string } | { ok: false; reason: "invalid" } {
  if (!token || !secret) return { ok: false, reason: "invalid" }
  const dot = token.lastIndexOf(".")
  if (dot <= 0) return { ok: false, reason: "invalid" }
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url")
  const actualBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (actualBuf.length !== expectedBuf.length) return { ok: false, reason: "invalid" }
  if (!crypto.timingSafeEqual(actualBuf, expectedBuf)) return { ok: false, reason: "invalid" }

  const json = decode(body)
  if (!json) return { ok: false, reason: "invalid" }
  let payload: TokenPayload
  try {
    payload = JSON.parse(json) as TokenPayload
  } catch {
    return { ok: false, reason: "invalid" }
  }
  if (typeof payload.e !== "string" || !payload.e.includes("@")) {
    return { ok: false, reason: "invalid" }
  }
  return { ok: true, email: payload.e }
}
