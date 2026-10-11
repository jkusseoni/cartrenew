import crypto from "crypto"

import { recoveryEmailHeaders } from "@/lib/email/template"

export type ResendWebhookHeaders = {
  id: string | null
  timestamp: string | null
  signature: string | null
}

/** Verify a Resend (Svix) webhook signature. Never log the secret. */
export function verifyResendWebhook(
  payload: string,
  headers: ResendWebhookHeaders,
  secret: string,
  nowMs: number = Date.now()
): boolean {
  const trimmed = secret.trim()
  if (!trimmed || !headers.id || !headers.timestamp || !headers.signature) return false

  const timestampSeconds = Number(headers.timestamp)
  if (!Number.isFinite(timestampSeconds)) return false
  if (Math.abs(nowMs - timestampSeconds * 1000) > 5 * 60 * 1000) return false

  let key: Buffer
  try {
    key = Buffer.from(trimmed.replace(/^whsec_/, ""), "base64")
  } catch {
    return false
  }
  if (key.length === 0) return false

  const signed = `${headers.id}.${headers.timestamp}.${payload}`
  const expected = crypto.createHmac("sha256", key).update(signed).digest("base64")

  return headers.signature.split(" ").some((part) => {
    const [version, signature] = part.split(",")
    if (version !== "v1" || !signature) return false
    const actual = Buffer.from(signature)
    const wanted = Buffer.from(expected)
    if (actual.length !== wanted.length) return false
    return crypto.timingSafeEqual(actual, wanted)
  })
}

export type ResendSendInput = {
  from: string
  to: string
  replyTo: string | null
  subject: string
  html: string
  text: string
  unsubscribeUrl: string
  apiKey: string
}

export type ResendFetch = typeof fetch

export async function sendResendEmail(
  input: ResendSendInput,
  fetchImpl: ResendFetch = fetch
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers: recoveryEmailHeaders(input.unsubscribeUrl),
    }),
  })

  const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string }
  if (!response.ok) {
    return { ok: false, error: body.message || `Resend HTTP ${response.status}` }
  }
  return { ok: true, id: body.id ?? null }
}

export type ResendEventKind = "hard_bounce" | "complaint" | "delivered" | "opened" | "ignore"

/** Classify a verified Resend webhook. Hard bounce is Permanent only. */
export function classifyResendEvent(payload: unknown): {
  kind: ResendEventKind
  email: string | null
  providerId: string | null
} {
  const row = payload as {
    type?: unknown
    data?: {
      email_id?: unknown
      to?: unknown
      bounce?: { type?: unknown }
    }
  }
  const type = typeof row?.type === "string" ? row.type : ""
  const to = Array.isArray(row?.data?.to) ? row.data?.to[0] : null
  const email = typeof to === "string" ? to.trim().toLowerCase() : null
  const providerId = typeof row?.data?.email_id === "string" ? row.data.email_id : null
  if (type === "email.bounced") {
    const bounceType = typeof row.data?.bounce?.type === "string" ? row.data.bounce.type : ""
    if (bounceType.toLowerCase() === "permanent") {
      return { kind: "hard_bounce", email, providerId }
    }
    return { kind: "ignore", email, providerId }
  }
  if (type === "email.complained") return { kind: "complaint", email, providerId }
  if (type === "email.delivered") return { kind: "delivered", email, providerId }
  if (type === "email.opened") return { kind: "opened", email, providerId }
  return { kind: "ignore", email, providerId }
}
