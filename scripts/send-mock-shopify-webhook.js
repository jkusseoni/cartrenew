#!/usr/bin/env node
const crypto = require('crypto')
const fetch = globalThis.fetch || require('node-fetch')

const SHOP_WEBHOOK_URL = process.env.SHOP_WEBHOOK_URL || 'http://localhost:3000/api/webhooks/shopify'
const SHOP_DOMAIN = process.env.SHOP_DOMAIN || 'example-store.myshopify.com'
const TOPIC = process.env.SHOP_TOPIC || 'carts/create'
const BYPASS = process.env.SHOPIFY_WEBHOOK_BYPASS === 'true'
const SHOPIFY_APP_API_SECRET = process.env.SHOPIFY_APP_API_SECRET || ''

const samplePayload = {
  token: 'mock-token-123',
  cart_token: 'mock-token-123',
  abandoned_checkout_url: 'https://example-store.myshopify.com/cart/12345',
  customer: {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone: '+1234567890',
  },
  line_items: [
    {
      title: 'Sample Product',
      quantity: 2,
      price: '29.99',
      variant_id: 111222333,
      product_id: 444555666,
      image: 'https://example.com/product.png',
    },
  ],
}

const body = JSON.stringify(samplePayload)

function makeHmac(payload) {
  return crypto.createHmac('sha256', SHOPIFY_APP_API_SECRET).update(payload, 'utf8').digest('base64')
}

const headers = {
  'Content-Type': 'application/json',
  'X-Shopify-Shop-Domain': SHOP_DOMAIN,
  'X-Shopify-Topic': TOPIC,
}

if (!BYPASS) {
  headers['X-Shopify-Hmac-Sha256'] = makeHmac(body)
} else {
  headers['X-Shopify-WebHook-Skip-Verify'] = 'true'
}

console.log('Sending mock webhook:', {
  url: SHOP_WEBHOOK_URL,
  topic: TOPIC,
  bypass: BYPASS,
})

fetch(SHOP_WEBHOOK_URL, {
  method: 'POST',
  headers,
  body,
})
  .then(async (res) => {
    console.log('Response status:', res.status)
    const text = await res.text()
    console.log('Response body:', text)
  })
  .catch((err) => {
    console.error('Webhook send failed:', err)
  })
