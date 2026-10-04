import assert from 'node:assert/strict'
import test from 'node:test'

test(
  'a Shopify webhook and cron first-attempt coordinate one send for the same cart',
  { timeout: 10_000 },
  async () => {
    const envKeys = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'SHOPIFY_WEBHOOK_VERIFY',
    ] as const
    const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
    const originalFetch = global.fetch

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://race-test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'hermetic-test-key'
    process.env.WHATSAPP_ACCESS_TOKEN = 'hermetic-test-token'
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'hermetic-test-phone-id'
    process.env.SHOPIFY_WEBHOOK_VERIFY = 'false'

    const cart = {
      id: '11111111-1111-4111-8111-111111111111',
      store_id: '22222222-2222-4222-8222-222222222222',
      customer_phone: '+447700900123',
      customer_name: 'Test Customer',
      checkout_url: 'https://shop.example/checkouts/race-test',
      status: 'pending',
    }
    let cartExists = false
    let cartClaimed = false
    let messageGetCount = 0
    let messageInsertCount = 0
    let graphSendCount = 0
    let releaseCartCreated!: () => void
    const cartCreated = new Promise<void>((resolve) => {
      releaseCartCreated = resolve
    })
    let releaseCoordinationObserved!: () => void
    const coordinationObserved = new Promise<void>((resolve) => {
      releaseCoordinationObserved = resolve
    })

    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })

    global.fetch = async (input, init) => {
      const request = new Request(input, init)
      const url = new URL(request.url)

      if (url.hostname === 'graph.facebook.com') {
        graphSendCount += 1
        return json({ messages: [{ id: `wamid-${graphSendCount}` }] })
      }

      assert.equal(url.hostname, 'race-test.supabase.co')
      const table = url.pathname.split('/').at(-1)

      if (table === 'stores' && request.method === 'GET') {
        return json([{ id: cart.store_id, shopify_access_token: null }])
      }

      if (table === 'abandoned_carts' && request.method === 'GET') {
        return json(cartExists ? [cart] : [])
      }

      if (table === 'abandoned_carts' && request.method === 'POST') {
        cartExists = true
        releaseCartCreated()
        return json([cart], 201)
      }

      if (table === 'abandoned_carts' && request.method === 'PATCH') {
        const body = JSON.parse(await request.text()) as Record<string, unknown>
        if ('processing_started_at' in body) {
          if (!cartClaimed) {
            cartClaimed = true
            return json([{ id: cart.id }])
          }
          releaseCoordinationObserved()
          return json([])
        }
        if (body.status === 'messaged') cart.status = 'messaged'
        return new Response(null, { status: 204 })
      }

      if (table === 'messages' && request.method === 'GET') {
        messageGetCount += 1
        if (messageGetCount >= 2) releaseCoordinationObserved()
        return json([])
      }

      if (table === 'messages' && request.method === 'POST') {
        messageInsertCount += 1
        const messageId = `message-${messageInsertCount}`
        await coordinationObserved
        return json({ id: messageId }, 201)
      }

      if (table === 'messages' && request.method === 'PATCH') {
        return new Response(null, { status: 204 })
      }

      if (table === 'analytics_daily' && request.method === 'GET') {
        return json([])
      }

      if (table === 'analytics_daily' && request.method === 'POST') {
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected request: ${request.method} ${request.url}`)
    }

    try {
      const [{ POST }, { processFirstAttempts }] = await Promise.all([
        import('../app/api/webhooks/shopify/route'),
        import('../lib/services/recovery-dispatch'),
      ])
      const payload = JSON.stringify({
        token: 'race-test-token',
        abandoned_checkout_url: cart.checkout_url,
        currency: 'USD',
        line_items: [{ title: 'Test item', quantity: 1, price: '42.00' }],
        customer: {
          first_name: 'Test',
          last_name: 'Customer',
          phone: cart.customer_phone,
        },
      })
      const webhookRequest = new Request(
        'https://cartrenew.example/api/webhooks/shopify',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-shopify-topic': 'checkouts/create',
            'x-shopify-shop-domain': 'shop.example',
          },
          body: payload,
        }
      )

      const webhook = POST(webhookRequest)
      await cartCreated
      const cron = processFirstAttempts({ limit: 1 })
      const [webhookResponse, cronResults] = await Promise.all([webhook, cron])

      assert.equal(webhookResponse.status, 200)
      assert.equal(cronResults.length, 1)
      assert.ok(
        cronResults[0]?.outcome === 'sent' || cronResults[0]?.outcome === 'skipped'
      )
      assert.equal(messageInsertCount, 1, 'only the claim winner inserted a messages row')
      assert.equal(graphSendCount, 1, 'only the claim winner called the Meta send endpoint')
    } finally {
      global.fetch = originalFetch
      for (const key of envKeys) {
        const value = originalEnv[key]
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  }
)
