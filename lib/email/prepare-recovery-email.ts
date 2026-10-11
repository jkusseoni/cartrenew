import { brand } from "@/lib/brand"
import {
  decideRecoveryEmail,
  isEmailRecoveryEnabled,
  parseEmailAllowlist,
  type EmailGateReason,
} from "@/lib/email/recovery-gate"
import { signUnsubscribeToken } from "@/lib/email/unsubscribe-token"
import {
  itemTitles,
  RECOVERY_EMAIL_SUBJECT,
  renderRecoveryEmail,
} from "@/lib/email/template"
import { sendResendEmail, type ResendFetch } from "@/lib/email/resend"
import { supabaseAdmin } from "@/lib/supabase"
import { resolveWhatsAppRecipient } from "@/lib/services/whatsapp-meta"
import { redactSecrets } from "@/lib/services/redact-secrets"

export type PreparedRecoveryEmail =
  | { ok: false; reason: EmailGateReason | "cart_not_pending" | "schema_unavailable" }
  | {
      ok: true
      email: string
      from: string
      replyTo: string | null
      subject: string
      html: string
      text: string
      unsubscribeUrl: string
    }

function clean(value: string | undefined): string {
  return (value ?? "").replace(/['"]/g, "").trim()
}

function formatFrom(fromEmail: string, fromName: string | null): string {
  const name = (fromName ?? "").replace(/[<>"]/g, "").trim()
  if (!name) return fromEmail
  return `${name} <${fromEmail}>`
}

export type RecoveryEmailSnapshot = {
  isDefaultBrand: boolean
  enabled: boolean
  platform: string | null
  phone: string | null
  buyerAcceptsMarketing: boolean
  email: string | null
  suppressed: boolean
  allowlistRaw: string | null
  fromEmail: string
  fromName: string | null
  replyTo: string | null
  unsubscribeSecret: string
  appUrl: string | null
  checkoutUrl: string | null
  postalAddress: string | null
  storeName: string
  items: unknown
}

/** Gate, render, and address the message. No database access. */
export function composeRecoveryEmail(snapshot: RecoveryEmailSnapshot): PreparedRecoveryEmail {
  const phone = snapshot.phone ?? ""
  const whatsappSendable = Boolean(phone.trim()) && resolveWhatsAppRecipient(phone).ok
  const decision = decideRecoveryEmail({
    isDefaultBrand: snapshot.isDefaultBrand,
    enabled: snapshot.enabled,
    platform: snapshot.platform,
    whatsappSendable,
    buyerAcceptsMarketing: snapshot.buyerAcceptsMarketing,
    email: snapshot.email,
    suppressed: snapshot.suppressed,
    allowlist: parseEmailAllowlist(snapshot.allowlistRaw),
    senderConfigured: Boolean(clean(snapshot.fromEmail)),
    unsubscribeConfigured: Boolean(clean(snapshot.unsubscribeSecret)),
    appUrl: snapshot.appUrl,
    checkoutUrl: snapshot.checkoutUrl,
    postalAddress: snapshot.postalAddress,
  })
  if (!decision.ok) return decision

  const fromEmail = clean(snapshot.fromEmail)
  const secret = clean(snapshot.unsubscribeSecret)
  const postal = clean(snapshot.postalAddress ?? "")
  const token = signUnsubscribeToken(decision.email, secret)
  const appUrl = (snapshot.appUrl ?? "").replace(/\/$/, "")
  const unsubscribeUrl = `${appUrl}/unsubscribe/${token}`
  const rendered = renderRecoveryEmail({
    storeName: snapshot.storeName,
    items: itemTitles(snapshot.items),
    checkoutUrl: String(snapshot.checkoutUrl),
    unsubscribeUrl,
    postalAddress: postal,
  })

  return {
    ok: true,
    email: decision.email,
    from: formatFrom(fromEmail, snapshot.fromName),
    replyTo: snapshot.replyTo,
    subject: RECOVERY_EMAIL_SUBJECT,
    html: rendered.html,
    text: rendered.text,
    unsubscribeUrl,
  }
}

export async function prepareRecoveryEmail(cartId: string): Promise<PreparedRecoveryEmail> {
  if (brand.isDefault) return { ok: false, reason: "default_brand" }

  const enabled = isEmailRecoveryEnabled(process.env.EMAIL_RECOVERY_ENABLED)
  const allowlist = parseEmailAllowlist(process.env.EMAIL_RECOVERY_ALLOWLIST)
  if (enabled && allowlist.mode === "unset" && !brand.isDefault) {
    console.warn("Email recovery allowlist is empty; refusing to send until it is set")
  }

  const { data: cart, error } = await supabaseAdmin
    .from("abandoned_carts")
    .select(
      "id, store_id, status, platform, customer_phone, customer_email, customer_name, checkout_url, items, email_marketing_consent"
    )
    .eq("id", cartId)
    .maybeSingle()

  if (error) {
    console.error("Email recovery cart lookup failed:", redactSecrets(error.message))
    return { ok: false, reason: "schema_unavailable" }
  }
  if (!cart || cart.status !== "pending") return { ok: false, reason: "cart_not_pending" }

  const phone = typeof cart.customer_phone === "string" ? cart.customer_phone : ""
  const email = typeof cart.customer_email === "string" ? cart.customer_email : null
  const normalized = (email ?? "").trim().toLowerCase()

  let suppressed = false
  if (normalized) {
    const { data: rows, error: suppressionError } = await supabaseAdmin
      .from("email_suppressions")
      .select("email")
      .eq("email", normalized)
      .limit(1)
    if (suppressionError) {
      console.error("Email suppression lookup failed:", redactSecrets(suppressionError.message))
      return { ok: false, reason: "schema_unavailable" }
    }
    suppressed = (rows?.length ?? 0) > 0
  }

  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("email_from_name, reply_to_email, store_name")
    .eq("id", cart.store_id)
    .maybeSingle()

  return composeRecoveryEmail({
    isDefaultBrand: brand.isDefault,
    enabled,
    platform: typeof cart.platform === "string" ? cart.platform : null,
    phone,
    buyerAcceptsMarketing: cart.email_marketing_consent === true,
    email,
    suppressed,
    allowlistRaw: process.env.EMAIL_RECOVERY_ALLOWLIST ?? null,
    fromEmail: process.env.RESEND_FROM_EMAIL ?? "",
    fromName: (store?.email_from_name as string | null) ?? null,
    replyTo: (store?.reply_to_email as string | null) ?? null,
    unsubscribeSecret: process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "",
    appUrl: brand.appUrl || null,
    checkoutUrl: typeof cart.checkout_url === "string" ? cart.checkout_url : null,
    postalAddress: clean(process.env.EMAIL_POSTAL_ADDRESS) || null,
    storeName: (store?.store_name as string | null) || brand.name,
    items: cart.items,
  })
}

export async function deliverPreparedEmail(
  prepared: Extract<PreparedRecoveryEmail, { ok: true }>,
  fetchImpl?: ResendFetch
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const apiKey = clean(process.env.RESEND_API_KEY)
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY missing" }
  const result = await sendResendEmail(
    {
      from: prepared.from,
      to: prepared.email,
      replyTo: prepared.replyTo,
      subject: prepared.subject,
      html: prepared.html,
      text: prepared.text,
      unsubscribeUrl: prepared.unsubscribeUrl,
      apiKey,
    },
    fetchImpl
  )
  if (!result.ok) return { ok: false, error: redactSecrets(result.error) }
  return result
}
