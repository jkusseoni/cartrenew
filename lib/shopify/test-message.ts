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

export const TEST_MESSAGE_DAILY_LIMIT = 3

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

export type TestMessageOutcome =
  | { status: 'sent'; remaining: number }
  | { status: 'send_failed'; remaining: number }
  | { status: 'rate_limited' }
  | { status: 'log_unavailable' }

const LOG_TAG = '[shopify/test-message]'

function errorText(error: unknown): string {
  return storedCustomerError(error instanceof Error ? error.message : String(error))
}

/**
 * Reserve a slot, send once, record the result. A reservation that lands
 * outside the first TEST_MESSAGE_DAILY_LIMIT rows of the UTC day is removed
 * again, so concurrent requests can't exceed the limit.
 */
export async function sendShopifyTestMessage({
  storeId,
  shop,
  e164,
  now = new Date(),
  log,
  send,
}: {
  storeId: string
  shop: string
  e164: string
  now?: Date
  log: TestMessageLog
  send: SendTestTemplate
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

  const remaining = TEST_MESSAGE_DAILY_LIMIT - (slot + 1)
  if (!result.success) {
    console.warn(`${LOG_TAG} send failed`, { shop, phone: maskedPhone, error })
    return { status: 'send_failed', remaining }
  }

  console.info(`${LOG_TAG} sent`, { shop, phone: maskedPhone, messageId: result.messageId ?? null })
  return { status: 'sent', remaining }
}
