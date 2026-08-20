import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldDispatchImmediateRecovery } from '../lib/services/recovery-dispatch'

const pendingCart = { id: 'cart-1', status: 'pending' }

test('dispatches for a newly persisted cart with a phone', () => {
  assert.equal(
    shouldDispatchImmediateRecovery({
      cart: pendingCart,
      created: true,
      customerPhone: '+15551234567',
      previousPhone: null,
      checkoutUrl: null,
    }),
    true
  )
})

test('dispatches when an existing pending cart first receives a phone', () => {
  assert.equal(
    shouldDispatchImmediateRecovery({
      cart: pendingCart,
      created: false,
      customerPhone: '+15551234567',
      previousPhone: null,
      checkoutUrl: null,
    }),
    true
  )
})

test('does not dispatch again for routine updates to a pending cart', () => {
  assert.equal(
    shouldDispatchImmediateRecovery({
      cart: pendingCart,
      created: false,
      customerPhone: '+15551234567',
      previousPhone: '+15551234567',
      checkoutUrl: null,
    }),
    false
  )
})

test('does not dispatch without a phone or recovery destination', () => {
  assert.equal(
    shouldDispatchImmediateRecovery({
      cart: pendingCart,
      created: true,
      customerPhone: null,
      previousPhone: null,
      checkoutUrl: null,
    }),
    false
  )

  assert.equal(
    shouldDispatchImmediateRecovery({
      cart: null,
      created: true,
      customerPhone: '+15551234567',
      previousPhone: null,
      checkoutUrl: null,
    }),
    false
  )
})

test('does not dispatch after a cart leaves pending status', () => {
  assert.equal(
    shouldDispatchImmediateRecovery({
      cart: { id: 'cart-1', status: 'messaged' },
      created: false,
      customerPhone: '+15551234567',
      previousPhone: null,
      checkoutUrl: null,
    }),
    false
  )
})
