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
  recoveryEmailSubject,
  recoveryFromName,
  recoveryStoreDisplayName,
  renderRecoveryEmail,
} from "@/lib/email/template"
import { sendResendEmail, type ResendFetch } from "@/lib/email/resend"
import { supabaseAdmin } from "@/lib/supabase"
import { resolveWhatsAppRecipient } from "@/lib/services/whatsapp-meta"
import { readOptionalStoreName } from "@/lib/email/store-name-lookup"
import { suppressionLookupKeys } from "@/lib/privacy/suppression-hash"
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
  /** Checkout SMS/WhatsApp marketing opt-in. Without it the phone is not used. */
  whatsappConsent: boolean
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
  const whatsappSendable =
    snapshot.whatsappConsent && Boolean(phone.trim()) && resolveWhatsAppRecipient(phone).ok
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
    brandName: brand.name,
    items: itemTitles(snapshot.items),
    checkoutUrl: String(snapshot.checkoutUrl),
    unsubscribeUrl,
    postalAddress: postal,
  })

  return {
    ok: true,
    email: decision.email,
    from: formatFrom(fromEmail, snapshot.fromName || snapshot.storeName),
    replyTo: snapshot.replyTo,
    subject: recoveryEmailSubject(snapshot.storeName),
    html: rendered.html,
    text: rendered.text,
    unsubscribeUrl,
  }
}

type RecoveryStoreRow = {
  storeName: string | null
  shopifyDomain: string | null
  emailFromName: string | null
  replyTo: string | null
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

/**
 * shopify_domain is on every store row. store_name is not on the Pingza schema
 * (it arrived with the WooCommerce migration), so it is read on its own. A
 * missing column must not blank the domain and fall through to "the store".
 */
async function loadRecoveryStore(storeId: string): Promise<RecoveryStoreRow> {
  const empty: RecoveryStoreRow = {
    storeName: null,
    shopifyDomain: null,
    emailFromName: null,
    replyTo: null,
  }
  const { data: core, error: coreError } = await supabaseAdmin
    .from("stores")
    .select("shopify_domain")
    .eq("id", storeId)
    .maybeSingle()
  if (coreError) {
    console.error("Email recovery store lookup failed:", redactSecrets(coreError.message))
    return empty
  }

  const storeName = await readOptionalStoreName(async () => {
    const { data, error } = await supabaseAdmin
      .from("stores")
      .select("store_name")
      .eq("id", storeId)
      .maybeSingle()
    return {
      data,
      error: error
        ? { code: error.code, message: error.message }
        : null,
    }
  })

  const { data: sender, error: senderError } = await supabaseAdmin
    .from("stores")
    .select("email_from_name, reply_to_email")
    .eq("id", storeId)
    .maybeSingle()
  if (senderError) {
    console.error("Email recovery sender lookup failed:", redactSecrets(senderError.message))
  }

  return {
    storeName,
    shopifyDomain: textOrNull(core?.shopify_domain),
    emailFromName: textOrNull(sender?.email_from_name),
    replyTo: textOrNull(sender?.reply_to_email),
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
      "id, store_id, status, platform, customer_phone, customer_email, customer_name, checkout_url, items, email_marketing_consent, sms_marketing_consent"
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
  const suppressionKeys = suppressionLookupKeys(normalized, process.env.SUPPRESSION_HASH_SECRET)
  if (suppressionKeys.length > 0) {
    const { data: rows, error: suppressionError } = await supabaseAdmin
      .from("email_suppressions")
      .select("email")
      .in("email", suppressionKeys)
      .limit(1)
    if (suppressionError) {
      console.error("Email suppression lookup failed:", redactSecrets(suppressionError.message))
      return { ok: false, reason: "schema_unavailable" }
    }
    suppressed = (rows?.length ?? 0) > 0
  }

  const store = await loadRecoveryStore(cart.store_id)
  const storeName = recoveryStoreDisplayName(store.storeName, store.shopifyDomain)

  return composeRecoveryEmail({
    isDefaultBrand: brand.isDefault,
    enabled,
    platform: typeof cart.platform === "string" ? cart.platform : null,
    phone,
    whatsappConsent: cart.sms_marketing_consent === true,
    buyerAcceptsMarketing: cart.email_marketing_consent === true,
    email,
    suppressed,
    allowlistRaw: process.env.EMAIL_RECOVERY_ALLOWLIST ?? null,
    fromEmail: process.env.RESEND_FROM_EMAIL ?? "",
    fromName: recoveryFromName(store.emailFromName, storeName),
    replyTo: store.replyTo,
    unsubscribeSecret: process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "",
    appUrl: brand.appUrl || null,
    checkoutUrl: typeof cart.checkout_url === "string" ? cart.checkout_url : null,
    postalAddress: clean(process.env.EMAIL_POSTAL_ADDRESS) || null,
    storeName,
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
