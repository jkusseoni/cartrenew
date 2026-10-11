/**
 * Strip WhatsApp credentials from text before it is logged or stored.
 * Never log the value being removed.
 */

function envAccessToken(): string {
  return (process.env.WHATSAPP_ACCESS_TOKEN ?? "").replace(/['"]/g, "")
}

export function redactSecrets(text: string): string {
  if (!text) return text

  let out = text
  const raw = envAccessToken()
  const compact = raw.replace(/\s/g, "")

  for (const secret of [raw, compact]) {
    if (secret.length >= 8) out = out.split(secret).join("[REDACTED]")
  }

  out = out.replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
  out = out.replace(/EAA[A-Za-z0-9]+/g, "[REDACTED]")
  return out
}
