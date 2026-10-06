import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeShopifyPhoneForSource } from '../../lib/shopify/phone'

test('normalizes a national shipping phone from its shipping country', () => {
  const payload = {
    shipping_address: { phone: '9876543210', country_code: 'IN' },
    billing_address: { country_code: 'US' },
  }

  assert.equal(
    normalizeShopifyPhoneForSource(
      payload.shipping_address.phone,
      'shipping_address.phone',
      payload,
      {}
    ),
    '+919876543210'
  )
})

test('normalizes a national billing phone from its billing country', () => {
  const payload = {
    shipping_address: { country_code: 'IN' },
    billing_address: { phone: '07911123456', country_code: 'GB' },
  }

  assert.equal(
    normalizeShopifyPhoneForSource(
      payload.billing_address.phone,
      'billing_address.phone',
      payload,
      {}
    ),
    '+447911123456'
  )
})

test('normalizes a default-address phone from that address country', () => {
  const customer = {
    default_address: { phone: '2025550123', country_code: 'US' },
  }

  assert.equal(
    normalizeShopifyPhoneForSource(
      customer.default_address.phone,
      'customer.default_address.phone',
      {},
      customer
    ),
    '+12025550123'
  )
})

test('does not borrow shipping country for a customer-level national phone', () => {
  assert.equal(
    normalizeShopifyPhoneForSource(
      '9876543210',
      'customer.phone',
      { shipping_address: { country_code: 'IN' } },
      {}
    ),
    '9876543210'
  )
})

test('does not borrow an address country for a top-level national phone', () => {
  assert.equal(
    normalizeShopifyPhoneForSource(
      '9876543210',
      'payload.phone',
      {
        shipping_address: { country_code: 'IN' },
        billing_address: { country_code: 'IN' },
      },
      {}
    ),
    '9876543210'
  )
})

test('keeps an explicit international number without address context', () => {
  assert.equal(
    normalizeShopifyPhoneForSource('+442079460018', 'payload.phone', {}, {}),
    '+442079460018'
  )
})

test('does not guess when the address country is unsupported', () => {
  const payload = {
    shipping_address: { phone: '9876543210', country_code: 'ZZ' },
  }

  assert.equal(
    normalizeShopifyPhoneForSource(
      payload.shipping_address.phone,
      'shipping_address.phone',
      payload,
      {}
    ),
    '9876543210'
  )
})
