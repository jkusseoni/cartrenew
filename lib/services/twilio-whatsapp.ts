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
  const abandonedCartContentSid = cleanEnv(process.env.TWILIO_ABANDONED_CART_CONTENT_SID)
  const contentSid = cleanEnv(process.env.TWILIO_CONTENT_SID)
  const edge = cleanEnv(process.env.TWILIO_EDGE)
  const region = cleanEnv(process.env.TWILIO_REGION)
  const resolvedContentSid = getTwilioAbandonedCartContentSid()

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
    TWILIO_ABANDONED_CART_CONTENT_SID: abandonedCartContentSid
      ? { present: true, prefix: abandonedCartContentSid.slice(0, 4), length: abandonedCartContentSid.length }
      : { present: false },
    TWILIO_CONTENT_SID: contentSid
      ? { present: true, prefix: contentSid.slice(0, 4), length: contentSid.length }
      : { present: false },
    resolvedAbandonedCartContentSid: resolvedContentSid
      ? { present: true, prefix: resolvedContentSid.slice(0, 4), length: resolvedContentSid.length }
      : { present: false },
    TWILIO_SANDBOX_TEMPLATE_MODE: getTwilioSandboxTemplateMode(),
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

/**
 * Prefer the dedicated Abandoned Cart Content template SID.
 * Falls back to TWILIO_CONTENT_SID for backwards compatibility.
 *
 * Sandbox note: custom abandoned-cart templates are NOT allowed in WhatsApp Sandbox.
 * Use TWILIO_SANDBOX_TEMPLATE_MODE=appointment|order to map variables onto the
 * pre-approved sandbox templates until a production WhatsApp sender is approved.
 */
export function getTwilioAbandonedCartContentSid(): string {
  return (
    cleanEnv(process.env.TWILIO_ABANDONED_CART_CONTENT_SID) ||
    cleanEnv(process.env.TWILIO_CONTENT_SID)
  )
}

/** @deprecated Prefer getTwilioAbandonedCartContentSid for cart recovery. */
export function getTwilioContentSid(): string {
  return getTwilioAbandonedCartContentSid()
}

/** Normalize customer name for WhatsApp templates — Guest/missing → friendly fallback. */
export function resolveRecoveryCustomerName(name?: string | null): string {
  const trimmed = name?.trim()
  if (!trimmed) return 'there'
  if (/^(guest|unknown|n\/?a|null|undefined)$/i.test(trimmed)) return 'there'
  return trimmed
}

export type TwilioSandboxTemplateMode = 'appointment' | 'order' | 'custom'

/**
 * Which pre-approved Sandbox template variable layout to use.
 * - appointment: "Your appointment is coming up on {{1}} at {{2}}"
 * - order: "Your {{1}} order of {{2}} has shipped and should be delivered on {{3}}. Details: {{4}}"
 * - custom: {{1}}=name, {{2}}=checkout link (production abandoned-cart template)
 */
export function getTwilioSandboxTemplateMode(): TwilioSandboxTemplateMode {
  const mode = cleanEnv(process.env.TWILIO_SANDBOX_TEMPLATE_MODE).toLowerCase()
  if (mode === 'order' || mode === 'appointment' || mode === 'custom') {
    return mode
  }
  // Default: appointment — matches the usual Sandbox ContentSid already in many .env files
  return 'appointment'
}

/**
 * Content template variables for cart recovery, shaped for the active template mode.
 *
 * Appointment (Sandbox default):
 *   {{1}} = "today (cart for {name})"
 *   {{2}} = checkout / recovery link
 *   → "Your appointment is coming up on today (cart for Rahul) at https://…"
 *
 * Order (better Sandbox fit — switch ContentSid to Order Notifications):
 *   {{1}} = brand/store, {{2}} = item summary, {{3}} = timing hint, {{4}} = link
 *
 * Custom (production abandoned-cart template):
 *   {{1}} = customer name, {{2}} = checkout link
 */
export function buildAbandonedCartContentVariables({
  customerName,
  checkoutUrl,
  storeName,
  itemSummary,
}: {
  customerName?: string | null
  checkoutUrl: string
  storeName?: string | null
  itemSummary?: string | null
}): Record<string, string> {
  const name = resolveRecoveryCustomerName(customerName)
  const brand = storeName?.trim() || 'CartRenew'
  const items = itemSummary?.trim() || 'saved cart items'
  const mode = getTwilioSandboxTemplateMode()

  if (mode === 'order') {
    return {
      '1': brand,
      '2': items,
      '3': 'today if you complete checkout',
      '4': checkoutUrl,
    }
  }

  if (mode === 'custom') {
    return {
      '1': name,
      '2': checkoutUrl,
    }
  }

  // appointment (default sandbox)
  return {
    '1': `today (cart for ${name})`,
    '2': checkoutUrl,
  }
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

  const contentSid = cleanEnv(options.contentSid) || getTwilioAbandonedCartContentSid()
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

  const requestPayload = {
    endpoint: `https://${apiHost}/2010-04-01/Accounts/{AccountSid}/Messages.json`,
    apiHost,
    timeoutMs: TWILIO_REQUEST_TIMEOUT_MS,
    from,
    to,
    contentSid: contentSid || null,
    contentVariables: contentVariables ?? null,
    hasBody: Boolean(body),
    bodyPreview: body ? body.slice(0, 120) : null,
    sandboxFrom: from.includes('14155238886'),
  }

  console.log('🌐 Twilio Messages API request payload:', JSON.stringify(requestPayload, null, 2))

  try {
    const message = await client.messages.create(createParams)
    const messageSid = message.sid

    // Dedicated line for Twilio Console lookup: Monitor → Logs → Messaging → search SID
    console.log(`📌 Twilio message_sid: ${messageSid}`)
    console.log(
      '✅ Twilio Messages API response:',
      JSON.stringify(
        {
          message_sid: messageSid,
          status: message.status,
          to: message.to,
          from: message.from,
          errorCode: message.errorCode ?? null,
          errorMessage: message.errorMessage ?? null,
          contentSid: contentSid || null,
          apiHost,
          consoleUrl: messageSid
            ? `https://console.twilio.com/us1/monitor/logs/sms/${messageSid}`
            : null,
        },
        null,
        2
      )
    )

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
    console.error('❌ Twilio failed request payload was:', JSON.stringify(requestPayload, null, 2))
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
  const greeting = resolveRecoveryCustomerName(customerName)

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
