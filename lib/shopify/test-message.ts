/**
 * Merchant "Send test message" for the embedded Shopify dashboard (Pingza only).
 *
 * A test send never creates an abandoned_carts or messages row, so it can't
 * show up in recovery metrics, analytics_daily or plan usage. Each attempt is
 * logged in cart_delivery_metrics with a masked phone; that log is also the
 * daily rate limit, so the limit holds across serverless instances.
 */

import { maskPhone } from '@/lib/phone'
import { storedCustomerError } from '@/lib/privacy/sanitize-customer-text'
import { resolveWhatsAppRecipient, type WhatsAppSendResult } from '@/lib/services/whatsapp-meta'
import { TEST_MESSAGE_DAILY_LIMIT } from '@/lib/shopify/test-message-config'

export { TEST_MESSAGE_DAILY_LIMIT }

/** cart_delivery_metrics.cart_id marker. Not a real cart id. */
export const TEST_MESSAGE_LOG_CART_ID = 'shopify-test-message'

/** Fills the template's customer-name slot so the message reads as a test. */
export const TEST_MESSAGE_CUSTOMER_NAME = '[TEST] Sample customer'

const E164_INPUT = /^\+[1-9]\d{7,14}$/

export const INVALID_TEST_PHONE_ERROR =
  'Enter a WhatsApp number in international format, starting with + and the country code (for example +447700900123).'

export type TestPhoneValidation = { ok: true; e164: string } | { ok: false; error: string }

/** Accepts E.164 only, allowing spaces, dashes, dots and brackets as separators. */
export function validateTestPhone(raw: unknown): TestPhoneValidation {
  if (typeof raw !== 'string') return { ok: false, error: INVALID_TEST_PHONE_ERROR }
  const compact = raw.trim().replace(/[\s().-]/g, '')
  if (!E164_INPUT.test(compact)) return { ok: false, error: INVALID_TEST_PHONE_ERROR }
  if (!resolveWhatsAppRecipient(compact).ok) return { ok: false, error: INVALID_TEST_PHONE_ERROR }
  return { ok: true, e164: compact }
}

/** The shop's own cart page, tagged so the link is recognisable as a test. */
export function testMessageCheckoutUrl(shop: string): string {
  return `https://${shop}/cart?test_message=1`
}

export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export type TestMessageLog = {
  /** Insert an in-progress attempt and return its id. */
  reserve(entry: { storeId: string; shop: string; maskedPhone: string }): Promise<string>
  /** Ids of the store's earliest attempts since `sinceIso`, oldest first. */
  earliestIdsSince(storeId: string, sinceIso: string, limit: number): Promise<string[]>
  release(id: string): Promise<void>
  finish(
    id: string,
    outcome: { success: boolean; messageId: string | null; error: string | null }
  ): Promise<void>
}

export type SendTestTemplate = (input: {
  phone: string
  customerName: string
  checkoutUrl: string
}) => Promise<WhatsAppSendResult>

/** How long the request waits for Meta before answering "still sending". */
export const TEST_MESSAGE_SEND_TIMEOUT_MS = 20_000

export type TestMessageOutcome =
  | { status: 'sent'; remaining: number }
  | { status: 'send_failed'; remaining: number }
  /** Meta hasn't answered in time. `completion` settles when the send and its log row finish. */
  | { status: 'pending'; remaining: number; completion: Promise<void> }
  | { status: 'rate_limited' }
  | { status: 'log_unavailable' }

const LOG_TAG = '[shopify/test-message]'

function errorText(error: unknown): string {
  return storedCustomerError(error instanceof Error ? error.message : String(error))
}

/**
 * Reserve a slot, send once, record the result. A reservation that lands
 * outside the first TEST_MESSAGE_DAILY_LIMIT rows of the UTC day is removed
 * again, so concurrent requests can't exceed the limit. If Meta takes longer
 * than `sendTimeoutMs`, the send keeps running and the outcome is 'pending'.
 */
export async function sendShopifyTestMessage({
  storeId,
  shop,
  e164,
  now = new Date(),
  log,
  send,
  sendTimeoutMs = TEST_MESSAGE_SEND_TIMEOUT_MS,
}: {
  storeId: string
  shop: string
  e164: string
  now?: Date
  log: TestMessageLog
  send: SendTestTemplate
  sendTimeoutMs?: number
}): Promise<TestMessageOutcome> {
  const maskedPhone = maskPhone(e164)

  let id: string
  try {
    id = await log.reserve({ storeId, shop, maskedPhone })
  } catch (error) {
    console.error(`${LOG_TAG} log reserve failed`, { shop, error: errorText(error) })
    return { status: 'log_unavailable' }
  }

  let slot: number
  try {
    const ids = await log.earliestIdsSince(
      storeId,
      utcDayStart(now).toISOString(),
      TEST_MESSAGE_DAILY_LIMIT
    )
    slot = ids.indexOf(id)
  } catch (error) {
    console.error(`${LOG_TAG} rate limit lookup failed`, { shop, error: errorText(error) })
    await log.release(id).catch(() => undefined)
    return { status: 'log_unavailable' }
  }

  if (slot === -1) {
    await log.release(id).catch((error) => {
      console.error(`${LOG_TAG} release failed`, { shop, error: errorText(error) })
    })
    console.warn(`${LOG_TAG} daily limit reached`, { shop })
    return { status: 'rate_limited' }
  }

  const remaining = TEST_MESSAGE_DAILY_LIMIT - (slot + 1)
  const startedAt = Date.now()

  const delivery = (async (): Promise<boolean> => {
    let result: WhatsAppSendResult
    try {
      result = await send({
        phone: e164,
        customerName: TEST_MESSAGE_CUSTOMER_NAME,
        checkoutUrl: testMessageCheckoutUrl(shop),
      })
    } catch (error) {
      result = { success: false, error: error instanceof Error ? error.message : String(error) }
    }
    const durationMs = Date.now() - startedAt

    const error = result.success ? null : storedCustomerError(result.error || 'send_failed')
    try {
      await log.finish(id, {
        success: result.success,
        messageId: result.messageId ?? null,
        error,
      })
    } catch (finishError) {
      console.error(`${LOG_TAG} log update failed`, { shop, error: errorText(finishError) })
    }

    if (result.success) {
      console.info(`${LOG_TAG} sent`, {
        shop,
        messageId: result.messageId ?? null,
        duration_ms: durationMs,
      })
    } else {
      console.warn(`${LOG_TAG} send failed`, { shop, error, duration_ms: durationMs })
    }
    return result.success
  })()

  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), sendTimeoutMs)
  })
  const first = await Promise.race([delivery, timedOut])
  clearTimeout(timer)

  if (first === 'timeout') {
    console.warn(`${LOG_TAG} send still running after timeout`, {
      shop,
      duration_ms: Date.now() - startedAt,
    })
    return { status: 'pending', remaining, completion: delivery.then(() => undefined) }
  }

  return first ? { status: 'sent', remaining } : { status: 'send_failed', remaining }
}

export const TEST_MESSAGE_PENDING_TEXT =
  'Your test message is being sent. It can take a minute to arrive.'

/** HTTP status and JSON body for each outcome of sendShopifyTestMessage. */
export function testMessageHttpResult(outcome: TestMessageOutcome): {
  status: number
  body: Record<string, unknown>
} {
  switch (outcome.status) {
    case 'sent':
      return { status: 200, body: { ok: true, remaining: outcome.remaining } }
    case 'pending':
      return {
        status: 202,
        body: { ok: true, pending: true, message: TEST_MESSAGE_PENDING_TEXT, remaining: outcome.remaining },
      }
    case 'send_failed':
      return {
        status: 502,
        body: {
          error:
            "WhatsApp didn't accept the test message. Check that the number is on WhatsApp and try again.",
          remaining: outcome.remaining,
        },
      }
    case 'rate_limited':
      return {
        status: 429,
        body: {
          error: `You've used all ${TEST_MESSAGE_DAILY_LIMIT} test messages for today. The limit resets at 00:00 UTC.`,
          remaining: 0,
        },
      }
    case 'log_unavailable':
      return {
        status: 503,
        body: { error: 'Test messages are unavailable right now. Try again in a moment.' },
      }
  }
}
