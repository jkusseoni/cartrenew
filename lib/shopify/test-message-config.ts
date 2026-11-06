/** Client-safe: imported by the embedded dashboard pages. */

/** cart_delivery_metrics.cart_id marker. Not a real cart id. */
export const TEST_MESSAGE_LOG_CART_ID = 'shopify-test-message'

export const TEST_MESSAGE_DAILY_LIMIT = 3

/** Meta codes that mean the utility/marketing send was not delivered to this number. */
export const TEST_MESSAGE_MARKETING_LIMIT_CODES = new Set([131049, 131048, 131047])

export const TEST_MESSAGE_NOT_DELIVERED =
  'WhatsApp did not deliver this message to this number.'

export const TEST_MESSAGE_TRY_ANOTHER_NUMBER = 'Try another WhatsApp number.'

export const TEST_MESSAGE_STILL_PENDING =
  'Still pending, WhatsApp has not confirmed delivery yet'

export function plainTestDeliveryError(error: string | null | undefined): string {
  const raw = (error ?? '').trim()
  const match = raw.match(/^(\d+)\b/)
  if (match && TEST_MESSAGE_MARKETING_LIMIT_CODES.has(Number(match[1]))) {
    return TEST_MESSAGE_NOT_DELIVERED
  }
  const title = raw.replace(/^\d+\s*:\s*/, '').trim()
  return title || 'WhatsApp could not deliver this message.'
}

export type TestDeliveryView =
  | { state: 'checking' }
  | { state: 'delivered'; text: string }
  | { state: 'failed'; text: string }
  | { state: 'unconfirmed'; text: string }

/** What the card says about Meta's delivery report. Never claims delivery Meta has not reported. */
export function testDeliveryView(
  status: string | null | undefined,
  error: string | null | undefined,
  timedOut = false
): TestDeliveryView {
  if (status === 'delivered' || status === 'read') {
    return { state: 'delivered', text: 'Delivered to WhatsApp.' }
  }
  if (status === 'failed') {
    return {
      state: 'failed',
      text: `${plainTestDeliveryError(error)} ${TEST_MESSAGE_TRY_ANOTHER_NUMBER}`,
    }
  }
  return timedOut
    ? { state: 'unconfirmed', text: TEST_MESSAGE_STILL_PENDING }
    : { state: 'checking' }
}

/** Response `code` when the typed number replied STOP. Same value as WHATSAPP_OPTED_OUT_ERROR. */
export const TEST_MESSAGE_OPTED_OUT_CODE = 'whatsapp_opted_out'

export const TEST_MESSAGE_OPTED_OUT_TEXT =
  'This number has opted out of messages (it replied STOP). Use a different number for testing.'
