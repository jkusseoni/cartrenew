import assert from 'node:assert/strict'
import test from 'node:test'

test('a concurrent first webhook cannot upsert the cart or enqueue recovery twice', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  process.env.TWILIO_ACCOUNT_SID = 'ACtest'
  process.env.TWILIO_AUTH_TOKEN = 'test-token'
  process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+15555550199'
  process.env.TWILIO_ABANDONED_CART_CONTENT_SID = 'HXtest'

  const originalFetch = global.fetch
  let abandonedCartReads = 0
  let releaseInitialReads!: () => void
  const initialReadsComplete = new Promise<void>((resolve) => {
    releaseInitialReads = resolve
  })
  const cartInsertPreferences: string[] = []
  let cartInsertCount = 0
  let messageInsertCount = 0

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })

  global.fetch = async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)

    assert.equal(url.hostname, 'test-project.supabase.co')
    const table = url.pathname.split('/').at(-1)

    if (table === 'stores' && request.method === 'GET') {
      return json([{ id: 'store-1', shopify_access_token: null }])
    }

    if (table === 'abandoned_carts' && request.method === 'GET') {
      abandonedCartReads += 1
      if (abandonedCartReads <= 2) {
        if (abandonedCartReads === 2) releaseInitialReads()
        await initialReadsComplete
        return json([])
      }
      return json([
        {
          id: 'cart-1',
          status: 'pending',
          customer_phone: '+15555550100',
        },
      ])
    }

    if (table === 'abandoned_carts' && request.method === 'POST') {
      cartInsertCount += 1
      cartInsertPreferences.push(request.headers.get('prefer') ?? '')
      if (cartInsertCount === 1) {
        return json([
          {
            id: 'cart-1',
            status: 'pending',
            customer_phone: '+15555550100',
          },
        ], 201)
      }
      return json(
        {
          code: '23505',
          message: 'duplicate key value violates unique constraint',
        },
        409
      )
    }

    if (table === 'messages' && request.method === 'POST') {
      messageInsertCount += 1
      return json({ id: 'message-1' }, 201)
    }

    if (table === 'analytics_daily' && request.method === 'GET') {
      return json([])
    }

    if (
      (table === 'analytics_daily' && request.method === 'POST') ||
      request.method === 'PATCH'
    ) {
      return new Response(null, { status: 204 })
    }

    throw new Error(`Unexpected request: ${request.method} ${request.url}`)
  }

  try {
    const { POST } = await import('../app/api/webhooks/shopify/route')
    // Reserved 555 fixture keeps the test hermetic: dispatch reaches the
    // durable message row, then phone validation stops before a Twilio request.
    const payload = JSON.stringify({
      token: 'shopify-cart-token',
      abandoned_checkout_url: 'https://shop.example/checkouts/shopify-cart-token',
      line_items: [{ title: 'Shirt', quantity: 1, price: '42.00' }],
      customer: {
        first_name: 'Customer',
        phone: '+15555550100',
      },
    })
    const makeRequest = () =>
      new Request('https://cartrenew.example/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shopify-topic': 'carts/create',
          'x-shopify-shop-domain': 'shop.example',
          'x-shopify-webhook-skip-verify': 'true',
        },
        body: payload,
      })

    const responses = await Promise.all([POST(makeRequest()), POST(makeRequest())])

    assert.deepEqual(
      responses.map((response) => response.status),
      [200, 200]
    )
    assert.equal(cartInsertCount, 2)
    assert.equal(
      cartInsertPreferences.some((preference) =>
        preference.includes('resolution=merge-duplicates')
      ),
      false,
      'cart creation must not use upsert conflict resolution'
    )
    assert.equal(messageInsertCount, 1)
  } finally {
    global.fetch = originalFetch
  }
})
