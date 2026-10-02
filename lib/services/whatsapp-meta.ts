/**
 * Direct Meta WhatsApp Cloud API client — replaces lib/services/twilio-whatsapp.ts.
 *
 * No BSP (Twilio/Gupshup/Interakt) in the loop. Sends straight to
 * graph.facebook.com using the production number's Phone Number ID
 * and a permanent System User access token.
 *
 * Required env vars (Vercel → Environment Variables):
 *   WHATSAPP_ACCESS_TOKEN      permanent System User token (Business Settings → System Users)
 *   WHATSAPP_PHONE_NUMBER_ID   from Meta app → Use case → WhatsApp → Production setup
 *   WHATSAPP_API_VERSION       optional, defaults to "v22.0"
 */

import { e164ToWhatsAppRecipient, maskPhone, toE164 } from '@/lib/phone'

function cleanEnv(value?: string | null): string {
    return (value ?? '').replace(/['"]/g, '').trim()
  }
  
  const PLACEHOLDER_PATTERNS = [
    /^\[.*\]$/,
    /\[PASTE/i,
    /your_/i,
    /placeholder/i,
    /\.\.\./,
  ]
  
  export function isPlaceholderCredential(value?: string | null): boolean {
    const normalized = cleanEnv(value)
    if (!normalized) return true
    return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))
  }
  
  export function hasWhatsAppCredentials(): boolean {
    const token = cleanEnv(process.env.WHATSAPP_ACCESS_TOKEN)
    const phoneNumberId = cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID)
    return !isPlaceholderCredential(token) && !isPlaceholderCredential(phoneNumberId)
  }
  
  /** Safe presence check for logs — never prints secret values. */
  export function getWhatsAppCredentialDiagnostics() {
    const token = cleanEnv(process.env.WHATSAPP_ACCESS_TOKEN)
    const phoneNumberId = cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID)
    const apiVersion = cleanEnv(process.env.WHATSAPP_API_VERSION) || 'v22.0'
  
    return {
      WHATSAPP_ACCESS_TOKEN: token
        ? { present: true, length: token.length }
        : { present: false },
      WHATSAPP_PHONE_NUMBER_ID: phoneNumberId
        ? { present: true, value: phoneNumberId }
        : { present: false },
      apiVersion,
      endpoint: phoneNumberId
        ? `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`
        : null,
    }
  }
  
  /** E.164 digits (no "+"), or null when the country can't be determined. Never assumes a default country. */
  export function normalizePhoneDigits(phone: string): string | null {
    const result = toE164(phone)
    return result.ok ? e164ToWhatsAppRecipient(result.e164) : null
  }

  function isPlaceholderPhoneDigits(digits: string): boolean {
    return /^1?555\d{0,7}$/.test(digits) || digits.includes('5551212')
  }

  /** Resolve a phone to a Graph API recipient, or the reason it can't be messaged. */
  export function resolveWhatsAppRecipient(
    phone: string
  ): { ok: true; to: string } | { ok: false; error: 'phone_missing' | 'phone_invalid' | 'phone_country_unknown' } {
    const result = toE164(phone)
    if (!result.ok) {
      const error =
        result.reason === 'country_unknown'
          ? 'phone_country_unknown'
          : result.reason === 'missing'
            ? 'phone_missing'
            : 'phone_invalid'
      return { ok: false, error }
    }
    const to = e164ToWhatsAppRecipient(result.e164)
    if (isPlaceholderPhoneDigits(to)) return { ok: false, error: 'phone_invalid' }
    return { ok: true, to }
  }

  /** True when the number is a real E.164 mobile Meta can message. */
  export function isValidWhatsAppPhone(phone: string): boolean {
    return resolveWhatsAppRecipient(phone).ok
  }

  /**
   * Meta's Graph API wants bare digits, no "+" and no "whatsapp:" prefix
   * (unlike Twilio's `whatsapp:+E164` format).
   */
  export function formatWhatsAppRecipient(phone: string): string | null {
    return normalizePhoneDigits(phone)
  }
  
  export function formatCartValue(cartValue: number, currency = 'USD'): string {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(cartValue)
    } catch {
      return `${currency.toUpperCase()} ${cartValue.toFixed(2)}`
    }
  }
  
  /** Normalize customer name for templates — Guest/missing → friendly fallback. */
  export function resolveRecoveryCustomerName(name?: string | null): string {
    const trimmed = name?.trim()
    if (!trimmed) return 'there'
    if (/^(guest|unknown|n\/?a|null|undefined)$/i.test(trimmed)) return 'there'
    return trimmed
  }
  
  export function formatAbandonedCartItemSummary(items?: unknown[] | null): string {
    if (!Array.isArray(items) || items.length === 0) return 'saved cart items'
    const summary = items
      .slice(0, 3)
      .map((item) => {
        const row = item as { title?: string; name?: string; quantity?: number }
        return `${row.title || row.name || 'item'} x${row.quantity || 1}`
      })
      .join(', ')
    return summary || 'saved cart items'
  }
  
  export type WhatsAppSendResult = {
    success: boolean
    messageId?: string | null
    status?: string | null
    error?: string | null
    to?: string | null
    templateName?: string | null
  }
  
  export type SendWhatsAppOptions = {
    /** Approved template name in WhatsApp Manager (required for business-initiated messages). */
    templateName: string
    languageCode?: string
    /** Positional body variables — index 0 fills {{1}}, index 1 fills {{2}}, etc. */
    bodyVariables?: string[]
  }
  
  /**
   * Build the {{1}}, {{2}} template variables for the abandoned-cart template.
   * {{1}} = customer name, {{2}} = checkout/recovery link.
   */
  export function buildAbandonedCartTemplateVariables({
    customerName,
    checkoutUrl,
  }: {
    customerName?: string | null
    checkoutUrl: string
  }): string[] {
    return [resolveRecoveryCustomerName(customerName), checkoutUrl]
  }
  
  function serializeFetchError(err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
      return { name: err.name, message: err.message, stack: err.stack }
    }
    return { message: String(err) }
  }
  
  /**
   * Send a WhatsApp template message via the Meta Cloud API directly.
   * Drop-in replacement for sendTwilioWhatsAppMessage — same call shape,
   * but always uses an approved template (Meta requires this for
   * business-initiated messages outside the 24h customer-service window).
   */
  export async function sendWhatsAppMessage(
    toPhone: string,
    options: SendWhatsAppOptions
  ): Promise<WhatsAppSendResult> {
    const diagnostics = getWhatsAppCredentialDiagnostics()
    console.log('🔐 WhatsApp credential diagnostics (production-safe):', diagnostics)
  
    if (!hasWhatsAppCredentials()) {
      console.error(
        '❌ WhatsApp credentials missing or placeholder. Check Vercel env for WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID.'
      )
      return { success: false, error: 'WhatsApp credentials missing or placeholder' }
    }
  
    const recipient = resolveWhatsAppRecipient(toPhone)
    if (!recipient.ok) {
      console.warn('⚠️ WhatsApp send skipped — destination phone not sendable:', {
        reason: recipient.error,
        phone: maskPhone(toPhone),
      })
      return { success: false, error: recipient.error, to: null }
    }
  
    if (!options.templateName) {
      return { success: false, error: 'Missing templateName — Meta requires an approved template' }
    }
  
    const to = recipient.to
    const token = cleanEnv(process.env.WHATSAPP_ACCESS_TOKEN)
    const phoneNumberId = cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID)
    const apiVersion = cleanEnv(process.env.WHATSAPP_API_VERSION) || 'v22.0'
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`
  
    const components = options.bodyVariables?.length
      ? [
          {
            type: 'body',
            parameters: options.bodyVariables.map((text) => ({ type: 'text', text })),
          },
        ]
      : undefined
  
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: options.templateName,
        language: { code: options.languageCode || 'en' },
        ...(components ? { components } : {}),
      },
    }
  
    console.log('🌐 Meta WhatsApp API request payload:', JSON.stringify(payload, null, 2))
  
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
  
      const data = await response.json()
  
      if (!response.ok) {
        console.error('❌ Meta WhatsApp API error response:', JSON.stringify(data, null, 2))
        return {
          success: false,
          error: data?.error?.message || `HTTP ${response.status}`,
          to,
          templateName: options.templateName,
        }
      }
  
      const messageId = data?.messages?.[0]?.id ?? null
      console.log('✅ Meta WhatsApp API response:', JSON.stringify(data, null, 2))
  
      return {
        success: true,
        messageId,
        status: 'sent',
        to,
        templateName: options.templateName,
      }
    } catch (err: unknown) {
      const details = serializeFetchError(err)
      console.error('❌ Meta WhatsApp API request failed:', details)
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        to,
        templateName: options.templateName,
        status: 'failed',
      }
    }
  }