/**
 * Permanent email-gate failures. These carts cannot be sent later, so Pingza
 * marks them skipped. Temporary config (flag off, missing sender, allowlist
 * miss) is intentionally absent and must stay pending.
 */
const PERMANENT_EMAIL_SKIP: Record<string, string> = {
  no_consent: "no_email_consent",
  suppressed: "email_suppressed",
  invalid_email: "invalid_email",
}

export function permanentEmailSkipError(reason: string): string | null {
  return PERMANENT_EMAIL_SKIP[reason] ?? null
}
