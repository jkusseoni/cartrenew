import assert from 'node:assert/strict'
import test from 'node:test'

test('app uninstall only marks open carts lost', async () => {
  const envKeys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SHOPIFY_WEBHOOK_VERIFY',
  ] as const
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  const originalFetch = global.fetch

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://uninstall-test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'hermetic-test-key'
  process.env.SHOPIFY_WEBHOOK_VERIFY = 'false'

  const storeId = '22222222-2222-4222-8222-222222222222'
  let cartStatusFilter: string | null = null
  let cartUpdate: Record<string, unknown> | null = null
  let storeUpdate: Record<string, unknown> | null = null

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })

  global.fetch = async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)

    assert.equal(url.hostname, 'uninstall-test.supabase.co')
    const table = url.pathname.split('/').at(-1)

    if (table === 'stores' && request.method === 'GET') {
      return json([{ id: storeId, shopify_access_token: 'offline-token' }])
    }

    if (table === 'abandoned_carts' && request.method === 'PATCH') {
      cartStatusFilter = url.searchParams.get('status')
      cartUpdate = JSON.parse(await request.text()) as Record<string, unknown>
      return new Response(null, { status: 204 })
    }

    if (table === 'stores' && request.method === 'PATCH') {
      storeUpdate = JSON.parse(await request.text()) as Record<string, unknown>
      return new Response(null, { status: 204 })
    }

    throw new Error(`Unexpected request: ${request.method} ${request.url}`)
  }

  try {
    const { POST } = await import('../app/api/webhooks/shopify/route')
    const response = await POST(
      new Request('https://cartrenew.example/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shopify-topic': 'app/uninstalled',
          'x-shopify-shop-domain': 'shop.example',
        },
        body: '{}',
      })
    )

    assert.equal(response.status, 200)
    assert.equal(cartStatusFilter, 'in.(pending,messaged)')
    assert.equal(cartUpdate?.status, 'lost')
    assert.equal(storeUpdate?.shopify_access_token, null)
    assert.equal(storeUpdate?.billing_status, 'cancelled')
  } finally {
    global.fetch = originalFetch
    for (const key of envKeys) {
      const value = originalEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
