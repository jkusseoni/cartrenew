import {
  composeRecoveryEmail,
  deliverPreparedEmail,
  type RecoveryEmailSnapshot,
} from "@/lib/email/prepare-recovery-email"
import type { ResendFetch } from "@/lib/email/resend"
import { resolveWhatsAppRecipient } from "@/lib/services/whatsapp-meta"

/**
 * Same branch the recovery cron uses for a pending cart with no message row.
 * Email only when the brand is not CartRenew, the cart is not WooCommerce,
 * and WhatsApp has no sendable phone.
 */
export function cronFirstChannel(input: {
  isDefaultBrand: boolean
  platform: string | null
  phone: string | null
}): "email" | "whatsapp" | "skip_missing_phone" {
  const phoneText = input.phone?.trim() ?? ""
  const whatsappSendable = Boolean(phoneText) && resolveWhatsAppRecipient(phoneText).ok
  const woo = (input.platform ?? "").toLowerCase() === "woocommerce"
  if (!input.isDefaultBrand && !woo && !whatsappSendable) return "email"
  if (!phoneText) return "skip_missing_phone"
  return "whatsapp"
}

export async function runCronFirstCandidate(input: {
  isDefaultBrand: boolean
  platform: string | null
  snapshot: RecoveryEmailSnapshot
  fetchImpl: ResendFetch
  sendWhatsApp: () => Promise<void>
}): Promise<{ channel: "email" | "whatsapp" | "none"; reason?: string }> {
  const channel = cronFirstChannel({
    isDefaultBrand: input.isDefaultBrand,
    platform: input.platform,
    phone: input.snapshot.phone,
  })
  if (channel === "whatsapp") {
    await input.sendWhatsApp()
    return { channel: "whatsapp" }
  }
  if (channel === "skip_missing_phone") {
    return { channel: "none", reason: "missing_phone" }
  }

  const prepared = composeRecoveryEmail(input.snapshot)
  if (!prepared.ok) return { channel: "none", reason: prepared.reason }
  const sent = await deliverPreparedEmail(prepared, input.fetchImpl)
  if (!sent.ok) return { channel: "email", reason: sent.error }
  return { channel: "email" }
}
