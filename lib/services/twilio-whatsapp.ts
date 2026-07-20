import https from 'https'
import twilio from 'twilio'
import RequestClient from 'twilio/lib/base/RequestClient'

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

/** Default request/socket timeout for Twilio API calls (Vercel-friendly). */
const TWILIO_REQUEST_TIMEOUT_MS = Number(
  cleanEnv(process.env.TWILIO_REQUEST_TIMEOUT_MS) || '15000'
)

/** Sandbox + production Messages API use the same host; edge only changes the subdomain. */
const TWILIO_API_HOST = 'api.twilio.com'

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

/** Safe presence check for logs — never prints secret values. */
export function getTwilioCredentialDiagnostics() {
  const accountSid = cleanEnv(process.env.TWILIO_ACCOUNT_SID)
  const authToken = cleanEnv(process.env.TWILIO_AUTH_TOKEN)
  const fromNumber = cleanEnv(process.env.TWILIO_WHATSAPP_NUMBER)
  const contentSid = cleanEnv(process.env.TWILIO_CONTENT_SID)
  const edge = cleanEnv(process.env.TWILIO_EDGE)
  const region = cleanEnv(process.env.TWILIO_REGION)

  return {
    TWILIO_ACCOUNT_SID: accountSid
      ? { present: true, prefix: accountSid.slice(0, 4), length: accountSid.length }
      : { present: false },
    TWILIO_AUTH_TOKEN: authToken
      ? { present: true, length: authToken.length }
      : { present: false },
    TWILIO_WHATSAPP_NUMBER: fromNumber
      ? { present: true, value: fromNumber }
      : { present: false },
    TWILIO_CONTENT_SID: contentSid
      ? { present: true, prefix: contentSid.slice(0, 4), length: contentSid.length }
      : { present: false },
    TWILIO_EDGE: edge || null,
    TWILIO_REGION: region || null,
    timeoutMs: TWILIO_REQUEST_TIMEOUT_MS,
    apiHost: buildTwilioApiHostname(edge, region),
  }
}

function buildTwilioApiHostname(edge?: string, region?: string): string {
  // Twilio sandbox uses the same Messages API endpoint as production.
  // Optional edge/region → e.g. api.singapore.us1.twilio.com
  if (!edge && !region) return TWILIO_API_HOST
  const parts = ['api', edge || undefined, region || (edge ? 'us1' : undefined), 'twilio', 'com']
  return parts.filter(Boolean).join('.')
}

/** Strip to digits and apply the same local→E.164 rules as formatWhatsAppAddress. */
export function normalizePhoneDigits(phone: string): string {
  let digits = phone.trim()
  if (digits.startsWith('whatsapp:')) {
    digits = digits.slice('whatsapp:'.length)
  }
  digits = digits.replace(/\D/g, '')
  if (digits.length === 10) {
    digits = `91${digits}`
  }
  return digits
}

/**
 * True when the number looks like a real E.164 mobile Twilio can dial.
 * Rejects short/placeholder Shopify fakes like +15551212 (Twilio error 21211).
 */
export function isValidWhatsAppPhone(phone: string): boolean {
  const digits = normalizePhoneDigits(phone)
  if (digits.length < 10 || digits.length > 15) return false
  // US fictional 555 exchange / classic Shopify sample numbers
  if (/^1?555\d{0,7}$/.test(digits)) return false
  if (digits.includes('5551212')) return false
  return true
}

/** Normalize customer phone to Twilio WhatsApp address (whatsapp:+E164). */
export function formatWhatsAppAddress(phone: string): string {
  return `whatsapp:+${normalizePhoneDigits(phone)}`
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
  status?: string | null
  error?: string | null
  to?: string | null
  contentSid?: string | null
  apiHost?: string | null
}

export type SendTwilioWhatsAppOptions = {
  /** Plain-text fallback when no ContentSid is used. */
  body?: string
  /** Twilio Content Template SID (e.g. HX…). Takes precedence over body. */
  contentSid?: string
  /** Template variables — keys match {{1}}, {{2}}, … in the Content template. */
  contentVariables?: Record<string, string>
}

export function getTwilioContentSid(): string {
  return cleanEnv(process.env.TWILIO_CONTENT_SID)
}

function serializeNetworkError(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== 'object') {
    return { message: String(err) }
  }

  const e = err as Error & {
    code?: string
    errno?: number | string
    syscall?: string
    address?: string
    port?: number
    status?: number
    statusCode?: number
    moreInfo?: string
    cause?: unknown
  }

  const cause =
    e.cause && typeof e.cause === 'object'
      ? serializeNetworkError(e.cause)
      : e.cause
        ? { message: String(e.cause) }
        : undefined

  return {
    name: e.name,
    message: e.message,
    code: e.code,
    errno: e.errno,
    syscall: e.syscall,
    address: e.address,
    port: e.port,
    status: e.status ?? e.statusCode,
    moreInfo: e.moreInfo,
    stack: e.stack,
    cause,
  }
}

function createTwilioClient(accountSid: string, authToken: string) {
  const edge = cleanEnv(process.env.TWILIO_EDGE) || undefined
  const region = cleanEnv(process.env.TWILIO_REGION) || undefined

  // Prefer IPv4 — some serverless runtimes hit ETIMEDOUT on IPv6 to api.twilio.com.
  const httpsAgent = new https.Agent({
    keepAlive: true,
    timeout: TWILIO_REQUEST_TIMEOUT_MS,
    family: 4,
    maxSockets: 10,
  })

  const httpClient = new RequestClient({
    timeout: TWILIO_REQUEST_TIMEOUT_MS,
    keepAlive: true,
    autoRetry: true,
    maxRetries: 2,
    maxSockets: 10,
  })
  httpClient.axios.defaults.httpsAgent = httpsAgent
  httpClient.axios.defaults.timeout = TWILIO_REQUEST_TIMEOUT_MS

  const client = twilio(accountSid, authToken, {
    httpClient,
    timeout: TWILIO_REQUEST_TIMEOUT_MS,
    autoRetry: true,
    maxRetries: 2,
    keepAlive: true,
    edge,
    region,
  })

  return { client, edge, region, apiHost: buildTwilioApiHostname(edge, region) }
}

/**
 * Send a WhatsApp message via Twilio.
 * Prefer ContentSid + ContentVariables (sandbox/approved templates); fall back to body text.
 * Sandbox and live accounts both use the Messages REST API on api.twilio.com (or edge host).
 */
export async function sendTwilioWhatsAppMessage(
  toPhone: string,
  bodyOrOptions: string | SendTwilioWhatsAppOptions
): Promise<TwilioWhatsAppSendResult> {
  const diagnostics = getTwilioCredentialDiagnostics()
  console.log('🔐 Twilio credential diagnostics (production-safe):', diagnostics)

  if (!hasTwilioWhatsAppCredentials()) {
    console.error(
      '❌ Twilio WhatsApp credentials missing or placeholder in this runtime. Check Vercel env for TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER.'
    )
    return {
      success: false,
      error: 'Twilio WhatsApp credentials missing or placeholder',
      apiHost: diagnostics.apiHost,
    }
  }

  const options: SendTwilioWhatsAppOptions =
    typeof bodyOrOptions === 'string' ? { body: bodyOrOptions } : bodyOrOptions

  if (!isValidWhatsAppPhone(toPhone)) {
    console.error('❌ Invalid WhatsApp destination phone (Twilio would return 21211):', {
      raw: toPhone,
      normalized: normalizePhoneDigits(toPhone),
    })
    return {
      success: false,
      error: `Invalid phone number: ${toPhone}`,
      to: toPhone,
      apiHost: diagnostics.apiHost,
    }
  }

  const contentSid = cleanEnv(options.contentSid) || getTwilioContentSid()
  const contentVariables = options.contentVariables
  const body = options.body
  const to = formatWhatsAppAddress(toPhone)
  const from = getTwilioWhatsAppFrom()

  if (!contentSid && !body) {
    return {
      success: false,
      error: 'Missing ContentSid and body — nothing to send',
      apiHost: diagnostics.apiHost,
    }
  }

  const accountSid = cleanEnv(process.env.TWILIO_ACCOUNT_SID)
  const authToken = cleanEnv(process.env.TWILIO_AUTH_TOKEN)
  const { client, apiHost } = createTwilioClient(accountSid, authToken)

  const createParams: {
    from: string
    to: string
    body?: string
    contentSid?: string
    contentVariables?: string
  } = { from, to }

  if (contentSid) {
    createParams.contentSid = contentSid
    if (contentVariables && Object.keys(contentVariables).length > 0) {
      createParams.contentVariables = JSON.stringify(contentVariables)
    }
  } else if (body) {
    createParams.body = body
  }

  console.log('🌐 Twilio Messages API request', {
    endpoint: `https://${apiHost}/2010-04-01/Accounts/{AccountSid}/Messages.json`,
    apiHost,
    timeoutMs: TWILIO_REQUEST_TIMEOUT_MS,
    from,
    to,
    contentSid: contentSid || null,
    hasBody: Boolean(body),
    sandboxFrom: from.includes('14155238886'),
  })

  try {
    const message = await client.messages.create(createParams)
    const messageSid = message.sid

    // Dedicated line for Twilio Console lookup: Monitor → Logs → Messaging → search SID
    console.log(`📌 Twilio message_sid: ${messageSid}`)
    console.log('✅ Twilio Messages API response', {
      message_sid: messageSid,
      status: message.status,
      to: message.to,
      from: message.from,
      errorCode: message.errorCode ?? null,
      errorMessage: message.errorMessage ?? null,
      apiHost,
      consoleUrl: messageSid
        ? `https://console.twilio.com/us1/monitor/logs/sms/${messageSid}`
        : null,
    })

    return {
      success: true,
      messageSid,
      status: message.status ?? null,
      to,
      contentSid: contentSid || null,
      apiHost,
    }
  } catch (err: unknown) {
    const details = serializeNetworkError(err)
    console.error('❌ Twilio Messages API connection/send failed — full error:', details)
    if (err instanceof Error && err.stack) {
      console.error('❌ Twilio error stack:\n', err.stack)
    }

    const errorMessage =
      err instanceof Error ? err.message : typeof err === 'string' ? err : String(err)

    return {
      success: false,
      error: errorMessage,
      to,
      contentSid: contentSid || null,
      status: 'failed',
      apiHost,
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
