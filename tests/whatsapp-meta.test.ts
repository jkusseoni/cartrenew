import { expect, test } from '@playwright/test'

import { decideAfterAttempt } from '../lib/recovery-retry-policy'
import { sendWhatsAppMessage } from '../lib/services/whatsapp-meta'

test('aborts a stalled Meta request within its request budget', async () => {
  const originalFetch = globalThis.fetch
  const originalToken = process.env.WHATSAPP_ACCESS_TOKEN
  const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token'
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789'

  globalThis.fetch = (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      expect(signal).toBeTruthy()
      if (!signal) throw new Error('Expected the Meta request to have an abort signal')
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })

  try {
    const startedAt = Date.now()
    const result = await sendWhatsAppMessage('+14155552671', {
      templateName: 'abandoned_cart_reminder',
      requestTimeoutMs: 20,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('WhatsApp API request timed out after 20ms')
    expect(decideAfterAttempt(result.success, result.error, 1, 0).kind).toBe('retry')
    expect(Date.now() - startedAt).toBeLessThan(1_000)
  } finally {
    globalThis.fetch = originalFetch
    if (originalToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN
    else process.env.WHATSAPP_ACCESS_TOKEN = originalToken
    if (originalPhoneNumberId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID
    else process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId
  }
})
