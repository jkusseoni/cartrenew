import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAbandonedCartUpdate,
  shouldDispatchCartRecovery,
} from '../../lib/services/abandoned-cart-webhook'

const completeRow = {
  store_id: 'store-1',
  shopify_cart_token: 'cart-1',
  customer_phone: '+15551234567',
  customer_email: 'customer@example.com',
  customer_name: 'Customer',
  cart_value: 42,
  items: [{ title: 'Shirt', quantity: 1 }],
  checkout_url: 'https://shop.example/checkouts/cart-1',
  updated_at: '2026-07-21T11:00:00.000Z',
}

test('omits absent contact and checkout fields from existing-cart updates', () => {
  const update = buildAbandonedCartUpdate({
    ...completeRow,
    customer_phone: null,
    customer_email: null,
    customer_name: null,
    checkout_url: null,
  })

  assert.equal('customer_phone' in update, false)
  assert.equal('customer_email' in update, false)
  assert.equal('customer_name' in update, false)
  assert.equal('checkout_url' in update, false)
  assert.equal(update.cart_value, 42)
  assert.deepEqual(update.items, completeRow.items)
})

test('includes newly supplied contact and checkout fields in updates', () => {
  const update = buildAbandonedCartUpdate(completeRow)

  assert.equal(update.customer_phone, completeRow.customer_phone)
  assert.equal(update.customer_email, completeRow.customer_email)
  assert.equal(update.customer_name, completeRow.customer_name)
  assert.equal(update.checkout_url, completeRow.checkout_url)
})

test('dispatches cart recovery only for a newly created cart or failed persistence', () => {
  assert.equal(
    shouldDispatchCartRecovery({
      canSendWhatsApp: true,
      cartExists: true,
      cartStatus: 'pending',
      created: true,
    }),
    true
  )
  assert.equal(
    shouldDispatchCartRecovery({
      canSendWhatsApp: true,
      cartExists: true,
      cartStatus: 'pending',
      created: false,
    }),
    false
  )
  assert.equal(
    shouldDispatchCartRecovery({
      canSendWhatsApp: true,
      cartExists: false,
      cartStatus: null,
      created: false,
    }),
    true
  )
})
