/**
 * Pure rules for Pingza recovery email. No I/O.
 *
 * Email runs only when WhatsApp cannot: there is no sendable phone, or the
 * shopper did not opt in to SMS/WhatsApp marketing at checkout.
 * A sendable, opted-in phone stays on WhatsApp, including after a later send
 * failure.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export type EmailGateReason =
  | "default_brand"
  | "disabled"
  | "woocommerce"
  | "whatsapp_possible"
  | "no_consent"
  | "invalid_email"
  | "suppressed"
  | "allowlist_empty"
  | "allowlist"
  | "missing_sender"
  | "missing_unsubscribe_secret"
  | "missing_app_url"
  | "missing_checkout"
  | "missing_postal"

export type EmailGateDecision =
  | { ok: true; email: string }
  | { ok: false; reason: EmailGateReason }

export type EmailAllowlist =
  | { mode: "unset" }
  | { mode: "all" }
  | { mode: "list"; emails: string[]; domains: string[] }

export type EmailGateInput = {
  isDefaultBrand: boolean
  enabled: boolean
  platform: string | null
  /** True when the phone can be sent on WhatsApp and the shopper opted in. Invalid or missing phones are false. */
  whatsappSendable: boolean
  buyerAcceptsMarketing: boolean
  email: string | null
  suppressed: boolean
  allowlist: EmailAllowlist
  senderConfigured: boolean
  unsubscribeConfigured: boolean
  appUrl: string | null
  checkoutUrl: string | null
  postalAddress: string | null
}

export function normalizeRecoveryEmail(value: string | null | undefined): string | null {
  const email = (value ?? "").trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return null
  return email
}

/**
 * Empty or missing allowlist does not mean "send to everyone".
 * "*" is the explicit send-to-all value. Other entries are emails or domains.
 */
export function parseEmailAllowlist(raw: string | undefined | null): EmailAllowlist {
  const parts = (raw ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  if (parts.length === 0) return { mode: "unset" }
  if (parts.includes("*")) return { mode: "all" }

  const emails: string[] = []
  const domains: string[] = []
  for (const part of parts) {
    const domain = part.startsWith("@") ? part.slice(1) : part
    if (part.includes("@") && normalizeRecoveryEmail(part)) emails.push(part)
    else if (domain && !domain.includes("@")) domains.push(domain)
  }
  return { mode: "list", emails, domains }
}

export function emailMatchesAllowlist(email: string, allowlist: EmailAllowlist): boolean {
  if (allowlist.mode === "all") return true
  if (allowlist.mode === "unset") return false
  if (allowlist.emails.includes(email)) return true
  const domain = email.split("@")[1] ?? ""
  return allowlist.domains.includes(domain)
}

/** Defaults off unless the variable is exactly "true". */
export function isEmailRecoveryEnabled(raw: string | undefined | null): boolean {
  return raw === "true"
}

export function decideRecoveryEmail(input: EmailGateInput): EmailGateDecision {
  if (input.isDefaultBrand) return { ok: false, reason: "default_brand" }
  if (!input.enabled) return { ok: false, reason: "disabled" }
  if ((input.platform ?? "").toLowerCase() === "woocommerce") {
    return { ok: false, reason: "woocommerce" }
  }
  if (input.whatsappSendable) return { ok: false, reason: "whatsapp_possible" }
  if (input.buyerAcceptsMarketing !== true) return { ok: false, reason: "no_consent" }

  const email = normalizeRecoveryEmail(input.email)
  if (!email) return { ok: false, reason: "invalid_email" }
  if (input.suppressed) return { ok: false, reason: "suppressed" }
  if (input.allowlist.mode === "unset") return { ok: false, reason: "allowlist_empty" }
  if (!emailMatchesAllowlist(email, input.allowlist)) return { ok: false, reason: "allowlist" }
  if (!input.senderConfigured) return { ok: false, reason: "missing_sender" }
  if (!input.unsubscribeConfigured) return { ok: false, reason: "missing_unsubscribe_secret" }
  if (!input.appUrl || !input.appUrl.startsWith("https://")) {
    return { ok: false, reason: "missing_app_url" }
  }
  if (!input.checkoutUrl || !input.checkoutUrl.startsWith("https://")) {
    return { ok: false, reason: "missing_checkout" }
  }
  if (!input.postalAddress?.trim()) return { ok: false, reason: "missing_postal" }
  return { ok: true, email }
}
