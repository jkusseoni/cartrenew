import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

type CartStatus = 'pending' | 'messaged' | 'recovered' | 'lost' | 'opted_out'

interface Cart {
  id: string
  status: CartStatus
  processing_started_at: string | null
  message_sent_at?: string
}

interface RecoveryResult {
  queued: boolean
  sent: boolean
  error?: string
  messageId?: string
}

const routeSource = fs.readFileSync(
  new URL('../../app/api/woocommerce/abandoned-cart/route.ts', import.meta.url),
  'utf8'
)
const compiledRoute = ts.transpileModule(routeSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: 'route.ts',
}).outputText

function createRoute(options: {
  cart: Cart
  synchronizeInitialReads?: boolean
  dispatch: () => Promise<RecoveryResult>
}) {
  const { cart, dispatch, synchronizeInitialReads = false } = options
  let abandonedCartReads = 0
  let dispatchCount = 0
  let releaseReads: (() => void) | undefined
  const initialReadsComplete = new Promise<void>((resolve) => {
    releaseReads = resolve
  })

  class MockQuery {
    private operation: 'read' | 'update' = 'read'
    private patch: Partial<Cart> = {}
    private predicates: Record<string, unknown> = {}

    constructor(private readonly table: string) {}

    select() {
      return this
    }

    update(patch: Partial<Cart>) {
      this.operation = 'update'
      this.patch = patch
      return this
    }

    eq(column: string, value: unknown) {
      this.predicates[column] = value
      return this
    }

    is(column: string, value: unknown) {
      this.predicates[column] = value
      return this
    }

    async maybeSingle() {
      if (this.table === 'stores') {
        return { data: { id: 'store-id', api_key: 'api-key' }, error: null }
      }

      if (this.operation === 'read') {
        const snapshot = { id: cart.id, status: cart.status }
        abandonedCartReads += 1
        if (synchronizeInitialReads) {
          if (abandonedCartReads === 2) releaseReads?.()
          await initialReadsComplete
        }
        return { data: snapshot, error: null }
      }

      const updated = this.applyUpdate()
      return { data: updated ? { id: cart.id } : null, error: null }
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      this.applyUpdate()
      return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected)
    }

    private applyUpdate() {
      if (this.table !== 'abandoned_carts' || this.operation !== 'update') return false

      const matches = Object.entries(this.predicates).every(
        ([column, value]) => cart[column as keyof Cart] === value
      )
      if (!matches) return false

      Object.assign(cart, this.patch)
      return true
    }
  }

  const supabaseAdmin = {
    from(table: string) {
      return new MockQuery(table)
    },
  }

  const routeModule = { exports: {} as Record<string, unknown> }
  const fakeRequire = (specifier: string) => {
    if (specifier === 'next/server') {
      return {
        NextResponse: {
          json(body: unknown, init?: { status?: number }) {
            return { body, status: init?.status ?? 200 }
          },
        },
      }
    }
    if (specifier === '@/lib/supabase') return { supabaseAdmin }
    if (specifier === '@/lib/services/messaging') {
      return {
        async triggerWhatsAppRecoveryForCart() {
          dispatchCount += 1
          return dispatch()
        },
      }
    }
    throw new Error(`Unexpected import in route under test: ${specifier}`)
  }

  new Function('require', 'module', 'exports', compiledRoute)(
    fakeRequire,
    routeModule,
    routeModule.exports
  )

  return {
    POST: routeModule.exports.POST as (request: Request) => Promise<{
      body: { status?: string }
      status: number
    }>,
    getDispatchCount: () => dispatchCount,
  }
}

function makeRequest() {
  return new Request('http://localhost/api/woocommerce/abandoned-cart', {
    method: 'POST',
    headers: {
      authorization: 'Bearer api-key',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      store_id: 'store-id',
      cart_key: 'cart-key',
      customer_name: 'Customer',
      phone_number: '+15555550100',
      cart_total: 42,
      checkout_url: 'https://example.test/checkout',
      cart_contents: [{ name: 'Item', quantity: 1, price: 42 }],
    }),
  })
}

test('concurrent duplicate requests atomically claim and dispatch only once', async () => {
  const cart: Cart = { id: 'cart-id', status: 'pending', processing_started_at: null }
  const route = createRoute({
    cart,
    synchronizeInitialReads: true,
    dispatch: async () => {
      assert.equal(cart.status, 'messaged')
      return { queued: true, sent: true, messageId: 'message-id' }
    },
  })

  const responses = await Promise.all([route.POST(makeRequest()), route.POST(makeRequest())])

  assert.equal(route.getDispatchCount(), 1)
  assert.deepEqual(
    responses.map((response) => response.body.status).sort(),
    ['already_processing', 'sent']
  )
  assert.ok(responses.every((response) => response.status === 200))
  assert.equal(cart.status, 'messaged')
  assert.equal(cart.processing_started_at, null)
})

test('pre-existing terminal carts are not dispatched or overwritten', async () => {
  const cart: Cart = { id: 'cart-id', status: 'recovered', processing_started_at: null }
  const route = createRoute({
    cart,
    dispatch: async () => ({ queued: true, sent: true, messageId: 'message-id' }),
  })

  const response = await route.POST(makeRequest())

  assert.equal(response.status, 200)
  assert.equal(response.body.status, 'already_processed')
  assert.equal(route.getDispatchCount(), 0)
  assert.equal(cart.status, 'recovered')
})

test('a recovered transition is preserved after a successful dispatch', async () => {
  const cart: Cart = { id: 'cart-id', status: 'pending', processing_started_at: null }
  const route = createRoute({
    cart,
    dispatch: async () => {
      cart.status = 'recovered'
      return { queued: true, sent: true, messageId: 'message-id' }
    },
  })

  const response = await route.POST(makeRequest())

  assert.equal(response.status, 200)
  assert.equal(cart.status, 'recovered')
})

test('a recovered transition is preserved after a soft dispatch failure', async () => {
  const cart: Cart = { id: 'cart-id', status: 'pending', processing_started_at: null }
  const route = createRoute({
    cart,
    dispatch: async () => {
      cart.status = 'recovered'
      return { queued: true, sent: false, error: 'provider_failure' }
    },
  })

  const response = await route.POST(makeRequest())

  assert.equal(response.status, 502)
  assert.equal(cart.status, 'recovered')
})

test('a recovered transition is preserved when dispatch throws', async () => {
  const cart: Cart = { id: 'cart-id', status: 'pending', processing_started_at: null }
  const route = createRoute({
    cart,
    dispatch: async () => {
      cart.status = 'recovered'
      throw new Error('provider_failure')
    },
  })

  const response = await route.POST(makeRequest())

  assert.equal(response.status, 502)
  assert.equal(cart.status, 'recovered')
})
