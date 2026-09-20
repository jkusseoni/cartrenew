import assert from 'node:assert/strict'
import test from 'node:test'
import { preserveExistingCartFields } from '../../lib/shopify/abandoned-cart-update'

test('omits missing recovery fields from partial webhook updates', () => {
  const row = {
    store_id: 'store-1',
    shopify_cart_token: 'cart-1',
    customer_phone: null,
    customer_email: undefined,
    customer_name: '',
    checkout_url: null,
    cart_value: 125,
    items: [{ title: 'Shoes', quantity: 1 }],
  }

  assert.deepEqual(preserveExistingCartFields(row), {
    store_id: 'store-1',
    shopify_cart_token: 'cart-1',
    cart_value: 125,
    items: [{ title: 'Shoes', quantity: 1 }],
  })
})

test('keeps newly supplied recovery fields in webhook updates', () => {
  const row = {
    customer_phone: '+15551234567',
    customer_email: 'shopper@example.com',
    customer_name: 'Shopper',
    checkout_url: 'https://example.myshopify.com/checkouts/cart-1',
  }

  assert.deepEqual(preserveExistingCartFields(row), row)
})
