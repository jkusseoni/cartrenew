import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatWhatsAppRecipient,
  isValidWhatsAppPhone,
  normalizePhoneDigits,
} from '../../lib/services/whatsapp-meta'

test('does not silently assign India to a bare local number', () => {
  const localUsNumber = '(415) 234-5678'

  assert.equal(normalizePhoneDigits(localUsNumber), '4152345678')
  assert.equal(isValidWhatsAppPhone(localUsNumber), false)
})

test('preserves explicit international recipients', () => {
  assert.equal(isValidWhatsAppPhone('+47 12 34 56 78'), true)
  assert.equal(formatWhatsAppRecipient('+47 12 34 56 78'), '4712345678')

  assert.equal(isValidWhatsAppPhone('whatsapp:+1 (415) 234-5678'), true)
  assert.equal(
    formatWhatsAppRecipient('whatsapp:+1 (415) 234-5678'),
    '14152345678'
  )
})

test('accepts digits-only E.164 values longer than ten digits', () => {
  assert.equal(isValidWhatsAppPhone('919876543210'), true)
  assert.equal(formatWhatsAppRecipient('919876543210'), '919876543210')
})
