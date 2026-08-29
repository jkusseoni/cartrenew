import { expect, test } from '@playwright/test'

import { sendWhatsAppMessage } from '../lib/services/whatsapp-meta'

type MetaTemplatePayload = {
  template: {
    language: {
      code: string
    }
  }
}

const originalFetch = globalThis.fetch
const originalEnv = {
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_TEMPLATE_LANG: process.env.WHATSAPP_TEMPLATE_LANG,
}

test.beforeEach(() => {
  process.env.WHATSAPP_ACCESS_TOKEN = 'unit-test-token'
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789'
})

test.afterEach(() => {
  globalThis.fetch = originalFetch

  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = value
    }
  }
})

test('uses the configured language for Meta template sends', async () => {
  process.env.WHATSAPP_TEMPLATE_LANG = 'en_IN'
  let requestBody: MetaTemplatePayload | undefined

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as MetaTemplatePayload
    return Response.json({ messages: [{ id: 'message-1' }] })
  }

  const result = await sendWhatsAppMessage('+919876543210', {
    templateName: 'abandoned_cart_reminder',
    bodyVariables: ['Customer', 'https://example.com/recover'],
  })

  expect(result.success).toBe(true)
  expect(requestBody?.template.language.code).toBe('en_IN')
})

test('allows an explicit language to override the configured default', async () => {
  process.env.WHATSAPP_TEMPLATE_LANG = 'en_IN'
  let requestBody: MetaTemplatePayload | undefined

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as MetaTemplatePayload
    return Response.json({ messages: [{ id: 'message-2' }] })
  }

  const result = await sendWhatsAppMessage('+919876543210', {
    templateName: 'abandoned_cart_reminder',
    languageCode: 'hi',
    bodyVariables: ['Customer', 'https://example.com/recover'],
  })

  expect(result.success).toBe(true)
  expect(requestBody?.template.language.code).toBe('hi')
})
