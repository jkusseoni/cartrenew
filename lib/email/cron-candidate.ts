import {
  composeRecoveryEmail,
  deliverPreparedEmail,
  type RecoveryEmailSnapshot,
} from "@/lib/email/prepare-recovery-email"
import type { ResendFetch } from "@/lib/email/resend"
import { resolveWhatsAppRecipient } from "@/lib/services/whatsapp-meta"

/** Stored as last_send_error on a cart skipped for having neither consent. */
export const NO_MARKETING_CONSENT = "no_marketing_consent"

/**
 * Same branch the recovery cron uses for a pending cart with no message row.
 *
 * CartRenew and WooCommerce carts: WhatsApp whenever there is a phone.
 * Pingza Shopify carts: WhatsApp only with checkout SMS/WhatsApp consent and
 * a sendable phone. Otherwise email when the checkout accepted email
 * marketing, and nothing at all when neither consent was given.
 */
export function cronFirstChannel(input: {
  isDefaultBrand: boolean
  platform: string | null
  phone: string | null
  whatsappConsent: boolean
  emailConsent: boolean
}): "email" | "whatsapp" | "skip_missing_phone" | "skip_no_consent" {
  const phoneText = input.phone?.trim() ?? ""
  const woo = (input.platform ?? "").toLowerCase() === "woocommerce"
  if (input.isDefaultBrand || woo) {
    return phoneText ? "whatsapp" : "skip_missing_phone"
  }

  if (!input.whatsappConsent && !input.emailConsent) return "skip_no_consent"
  const whatsappSendable = Boolean(phoneText) && resolveWhatsAppRecipient(phoneText).ok
  if (whatsappSendable && input.whatsappConsent) return "whatsapp"
  return input.emailConsent ? "email" : "skip_missing_phone"
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
    whatsappConsent: input.snapshot.whatsappConsent,
    emailConsent: input.snapshot.buyerAcceptsMarketing,
  })
  if (channel === "whatsapp") {
    await input.sendWhatsApp()
    return { channel: "whatsapp" }
  }
  if (channel === "skip_missing_phone") {
    return { channel: "none", reason: "missing_phone" }
  }
  if (channel === "skip_no_consent") {
    return { channel: "none", reason: NO_MARKETING_CONSENT }
  }

  const prepared = composeRecoveryEmail(input.snapshot)
  if (!prepared.ok) return { channel: "none", reason: prepared.reason }
  const sent = await deliverPreparedEmail(prepared, input.fetchImpl)
  if (!sent.ok) return { channel: "email", reason: sent.error }
  return { channel: "email" }
}
