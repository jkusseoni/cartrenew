import { redactSecrets } from "@/lib/services/redact-secrets"

/**
 * Strip contact details and checkout secrets before an error string is stored.
 * Token redaction still runs first.
 */
export function sanitizeCustomerText(value: string): string {
  let out = value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
  out = out.replace(/\S*key=\S*/gi, "[redacted-url]")
  out = out.replace(/\+?\d[\d\s().-]{6,}\d/g, (match) => {
    const digits = match.replace(/\D/g, "")
    if (digits.length >= 8 && digits.length <= 15) return "[redacted-phone]"
    return match
  })
  return out
}

export function storedCustomerError(value: string | null | undefined): string {
  return sanitizeCustomerText(redactSecrets(value ?? "")).slice(0, 500)
}
