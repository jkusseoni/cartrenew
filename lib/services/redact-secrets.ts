/**
 * Strip WhatsApp credentials from text before it is logged or stored.
 * Never log the value being removed.
 */

function envSecret(value: string | undefined): string {
  return (value ?? "").replace(/['"]/g, "")
}

export function redactSecrets(text: string): string {
  if (!text) return text

  let out = text
  const values = [
    process.env.WHATSAPP_ACCESS_TOKEN,
    process.env.RESEND_API_KEY,
    process.env.RESEND_WEBHOOK_SECRET,
    process.env.EMAIL_UNSUBSCRIBE_SECRET,
  ]
  for (const value of values) {
    const raw = envSecret(value)
    const compact = raw.replace(/\s/g, "")
    for (const secret of [raw, compact]) {
      if (secret.length >= 8) out = out.split(secret).join("[REDACTED]")
    }
  }

  out = out.replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
  out = out.replace(/EAA[A-Za-z0-9]+/g, "[REDACTED]")
  return out
}
