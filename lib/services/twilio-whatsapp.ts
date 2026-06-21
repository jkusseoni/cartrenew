import twilio from 'twilio'

function cleanEnv(value?: string | null): string {
  return (value ?? '').replace(/['"]/g, '').trim()
}

const PLACEHOLDER_PATTERNS = [
  /^\[.*\]$/,
  /\[PASTE/i,
  /your_/i,
  /placeholder/i,
  /^AC_your/i,
  /\.\.\./,
  /^AC_your_twilio/i,
]

export function isPlaceholderCredential(value?: string | null): boolean {
  const normalized = cleanEnv(value)
  if (!normalized) return true
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))
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

/** Normalize customer phone to Twilio WhatsApp address (whatsapp:+E164). */
export function formatWhatsAppAddress(phone: string): string {
  let digits = phone.trim()
  if (digits.startsWith('whatsapp:')) {
    digits = digits.slice('whatsapp:'.length)
  }
  digits = digits.replace(/\D/g, '')
  if (digits.length === 10) {
    digits = `91${digits}`
  }
  return `whatsapp:+${digits}`
}

export function getTwilioWhatsAppFrom(): string {
  const from = cleanEnv(process.env.TWILIO_WHATSAPP_NUMBER)
  if (!from) {
    throw new Error('TWILIO_WHATSAPP_NUMBER is not configured')
  }
  return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`
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

export type TwilioWhatsAppSendResult = {
  success: boolean
  messageSid?: string | null
  error?: string | null
}

export async function sendTwilioWhatsAppMessage(
  toPhone: string,
  body: string
): Promise<TwilioWhatsAppSendResult> {
  if (!hasTwilioWhatsAppCredentials()) {
    return {
      success: false,
      error: 'Twilio WhatsApp credentials missing or placeholder',
    }
  }

  const accountSid = cleanEnv(process.env.TWILIO_ACCOUNT_SID)
  const authToken = cleanEnv(process.env.TWILIO_AUTH_TOKEN)

  try {
    const client = twilio(accountSid, authToken)
    const message = await client.messages.create({
      from: getTwilioWhatsAppFrom(),
      to: formatWhatsAppAddress(toPhone),
      body,
    })

    return {
      success: true,
      messageSid: message.sid,
    }
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : typeof err === 'string' ? err : String(err)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

export function buildRecoveryWhatsAppBody({
  customerName,
  cartValue,
  currency,
  recoveryLink,
  items,
}: {
  customerName?: string | null
  cartValue: number
  currency?: string
  recoveryLink: string
  items?: unknown[]
}): string {
  const itemList = Array.isArray(items)
    ? items
        .map((item) => {
          const row = item as { title?: string; quantity?: number }
          return `• ${row.title || 'item'} (x${row.quantity || 1})`
        })
        .join('\n')
    : ''

  const formattedValue = formatCartValue(cartValue, currency)
  const greeting = customerName?.trim() || 'there'

  return [
    `Hi ${greeting}! 👋`,
    '',
    'You left something in your cart:',
    '',
    itemList || '• Your saved items',
    '',
    `Total: ${formattedValue}`,
    '',
    `Complete your order: ${recoveryLink}`,
    '',
    'Need help? Just reply to this message.',
  ].join('\n')
}
