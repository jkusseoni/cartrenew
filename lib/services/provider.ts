/**
 * Messaging provider router: Meta WhatsApp Cloud API → Twilio → mock (no fetch).
 */

export type ProviderSendResult = {
  success: boolean
  providerId?: string | null
  error?: string | null
  provider?: 'meta_whatsapp' | 'twilio_whatsapp' | 'mock_whatsapp'
  mocked?: boolean
}

export type ProviderMessage = {
  id: string
  to: string
  body: string
  templateName?: string
  metadata?: Record<string, unknown>
}

const PLACEHOLDER_PATTERNS = [
  /^\[.*\]$/,
  /\[PASTE/i,
  /your_/i,
  /placeholder/i,
  /^AC_your/i,
  /\.\.\./,
  /^123456789012345$/,
  /aapka_/i,
  /^EAAd\.\.\./i,
  /^sk_your/i,
  /^AC_your_twilio/i,
]

function cleanEnv(value?: string | null): string {
  return (value ?? '').replace(/['"]/g, '').trim()
}

export function isPlaceholderCredential(value?: string | null): boolean {
  const normalized = cleanEnv(value)
  if (!normalized) return true
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function hasMetaWhatsAppCredentials(): boolean {
  const accessToken = cleanEnv(process.env.WHATSAPP_ACCESS_TOKEN)
  const phoneNumberId = cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID)
  return !isPlaceholderCredential(accessToken) && !isPlaceholderCredential(phoneNumberId)
}

export function hasTwilioWhatsAppCredentials(): boolean {
  const accountSid = cleanEnv(process.env.TWILIO_ACCOUNT_SID)
  const authToken = cleanEnv(process.env.TWILIO_AUTH_TOKEN)
  const fromNumber = cleanEnv(process.env.TWILIO_WHATSAPP_NUMBER)
  return (
    !isPlaceholderCredential(accountSid) &&
    !isPlaceholderCredential(authToken) &&
    !isPlaceholderCredential(fromNumber)
  )
}

export function shouldUseMockWhatsAppSend(): boolean {
  return !hasMetaWhatsAppCredentials() && !hasTwilioWhatsAppCredentials()
}

function sanitizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`
  }
  return cleaned
}

export async function sendMessageViaMetaWhatsApp(msg: ProviderMessage): Promise<ProviderSendResult> {
  if (!hasMetaWhatsAppCredentials()) {
    return { success: false, error: 'Meta WhatsApp credentials missing or placeholder' }
  }

  const accessToken = cleanEnv(process.env.WHATSAPP_ACCESS_TOKEN)
  const phoneNumberId = cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID)
  // Only an env-configured, Meta-approved template name may be used here.
  // Internal DB labels (e.g. cart_recovery_default from messaging.ts) are NOT
  // WhatsApp Cloud API templates — using them made every Meta fallback fail.
  const metaTemplateName = cleanEnv(process.env.WHATSAPP_TEMPLATE_NAME)
  const useApprovedTemplate =
    Boolean(metaTemplateName) && !isPlaceholderCredential(metaTemplateName)

  try {
    const to = sanitizePhoneNumber(msg.to)
    const metaUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`

    const whatsappPayload = useApprovedTemplate
      ? {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: metaTemplateName,
            language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: msg.body.slice(0, 1024) }],
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: true, body: msg.body },
        }

    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(whatsappPayload),
    })

    // Meta occasionally returns non-JSON error bodies; never let parsing throw.
    const result = await response.json().catch(() => ({} as Record<string, any>))
    if (!response.ok) {
      return {
        success: false,
        error: result.error?.message || `Meta API responded with HTTP ${response.status}`,
        provider: 'meta_whatsapp',
      }
    }

    return {
      success: true,
      providerId: result.messages?.[0]?.id ?? null,
      provider: 'meta_whatsapp',
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      provider: 'meta_whatsapp',
    }
  }
}

export async function sendMessageViaTwilio(msg: ProviderMessage): Promise<ProviderSendResult> {
  const { sendTwilioWhatsAppMessage } = await import('@/lib/services/twilio-whatsapp')
  const result = await sendTwilioWhatsAppMessage(msg.to, msg.body)

  if (result.success) {
    return {
      success: true,
      providerId: result.messageSid ?? null,
      provider: 'twilio_whatsapp',
    }
  }

  return {
    success: false,
    error: result.error || 'Twilio send failed',
    provider: 'twilio_whatsapp',
  }
}

export async function sendMessage(msg: ProviderMessage): Promise<ProviderSendResult> {
  if (hasTwilioWhatsAppCredentials()) {
    const twilioResult = await sendMessageViaTwilio(msg)
    if (twilioResult.success) return twilioResult
  }

  const metaResult = await sendMessageViaMetaWhatsApp(msg)
  if (metaResult.success) return metaResult

  return {
    success: false,
    error:
      metaResult.error ||
      (hasTwilioWhatsAppCredentials() ? undefined : 'Twilio credentials missing or placeholder') ||
      'No WhatsApp provider available',
  }
}
