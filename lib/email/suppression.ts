import { normalizeRecoveryEmail } from "@/lib/email/recovery-gate"

export type SuppressionReason = "unsubscribed" | "bounced" | "complained"

export type SuppressionWrite = {
  row: { email: string; reason: SuppressionReason; store_id: null }
  options: { onConflict: "email"; ignoreDuplicates: true }
}

/** Lowercase the address and insert with ON CONFLICT DO NOTHING. */
export function suppressionInsert(
  email: string,
  reason: SuppressionReason
): SuppressionWrite | null {
  const normalized = normalizeRecoveryEmail(email)
  if (!normalized) return null
  return {
    row: { email: normalized, reason, store_id: null },
    options: { onConflict: "email", ignoreDuplicates: true },
  }
}
