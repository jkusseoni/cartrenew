import assert from 'node:assert/strict'
import { after, mock, test } from 'node:test'
import { NextRequest } from 'next/server'

type CartStatus = 'pending' | 'messaged' | 'recovered' | 'lost' | 'opted_out'
type DispatchMode = 'success' | 'soft-failure' | 'throw'

interface Scenario {
  existingStatus: CartStatus
  dispatchMode: DispatchMode
  dispatchCount: number
  updates: Array<Record<string, unknown>>
  concurrentBarrier?: {
    wait: Promise<void>
    release: () => void
  }
}

let activeScenario: Scenario | null = null

function scenario(): Scenario {
  assert.ok(activeScenario, 'A debug scenario must be active')
  return activeScenario
}

class FakeQuery {
  constructor(private readonly table: string) {}

  select() {
    return this
  }

  eq() {
    return this
  }

  insert(): never {
    throw new Error('The focused existing-cart reproducer must not insert rows')
  }

  update(values: Record<string, unknown>) {
    scenario().updates.push(values)
    return this
  }

  async maybeSingle() {
    if (this.table === 'stores') {
      return {
        data: { id: 'debug-store', api_key: 'debug-api-key' },
        error: null,
      }
    }

    if (this.table === 'abandoned_carts') {
      return {
        data: { id: 'debug-cart', status: scenario().existingStatus },
        error: null,
      }
    }

    throw new Error(`Unexpected maybeSingle table: ${this.table}`)
  }
}

const fakeSupabaseAdmin = {
  from(table: string) {
    return new FakeQuery(table)
  },
}

async function fakeTriggerWhatsAppRecoveryForCart() {
  const current = scenario()
  current.dispatchCount += 1

  if (current.concurrentBarrier) {
    if (current.dispatchCount === 2) {
      current.concurrentBarrier.release()
    }
    await current.concurrentBarrier.wait
  }

  if (current.dispatchMode === 'throw') {
    throw new Error('debug dispatch exception')
  }

  if (current.dispatchMode === 'soft-failure') {
    return { queued: true, sent: false, error: 'debug soft failure' }
  }

  return { queued: true, sent: true, messageId: 'debug-message' }
}

await mock.module(new URL('../lib/supabase.ts', import.meta.url).href, {
  namedExports: { supabaseAdmin: fakeSupabaseAdmin },
})
await mock.module(new URL('../lib/services/messaging.ts', import.meta.url).href, {
  namedExports: { triggerWhatsAppRecoveryForCart: fakeTriggerWhatsAppRecoveryForCart },
})

type RouteModule = {
  POST: (request: NextRequest) => Promise<Response>
}

const importedRoute = (await import(
  '../app/api/woocommerce/abandoned-cart/route.ts'
)) as unknown as Partial<RouteModule> & { default?: RouteModule }
const post = importedRoute.POST ?? importedRoute.default?.POST
assert.equal(typeof post, 'function')

after(() => mock.restoreAll())

function setScenario(existingStatus: CartStatus, dispatchMode: DispatchMode): Scenario {
  activeScenario = {
    existingStatus,
    dispatchMode,
    dispatchCount: 0,
    updates: [],
  }
  return activeScenario
}

function request() {
  return new NextRequest('http://localhost/api/woocommerce/abandoned-cart', {
    method: 'POST',
    headers: {
      authorization: 'Bearer debug-api-key',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      store_id: 'debug-store',
      cart_key: 'debug-cart-key',
      customer_name: 'Debug Customer',
      phone_number: 'debug-phone',
      cart_total: '42.00',
      checkout_url: 'https://example.test/debug-checkout',
      cart_contents: [{ name: 'Debug Item', quantity: 1, price: '42.00' }],
    }),
  })
}

for (const status of ['recovered', 'lost', 'opted_out'] as const) {
  test(`existing ${status} cart is terminal and must not dispatch or mutate`, async () => {
    const current = setScenario(status, 'success')

    await post!(request())

    assert.deepEqual(
      {
        dispatchCount: current.dispatchCount,
        updatedStatuses: current.updates.map((update) => update.status),
      },
      { dispatchCount: 0, updatedStatuses: [] }
    )
  })
}

test('soft dispatch failure must not reset an opted-out cart to pending', async () => {
  const current = setScenario('opted_out', 'soft-failure')

  await post!(request())

  assert.deepEqual(
    {
      dispatchCount: current.dispatchCount,
      updatedStatuses: current.updates.map((update) => update.status),
    },
    { dispatchCount: 0, updatedStatuses: [] }
  )
})

test('thrown dispatch failure must not reset a recovered cart to pending', async () => {
  const current = setScenario('recovered', 'throw')

  await post!(request())

  assert.deepEqual(
    {
      dispatchCount: current.dispatchCount,
      updatedStatuses: current.updates.map((update) => update.status),
    },
    { dispatchCount: 0, updatedStatuses: [] }
  )
})

test('messaged cart remains the existing no-dispatch control case', async () => {
  const current = setScenario('messaged', 'success')

  const response = await post!(request())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'already_sent' })
  assert.equal(current.dispatchCount, 0)
  assert.deepEqual(current.updates, [])
})

test('two concurrent requests for one pending cart dispatch at most once', async () => {
  let release!: () => void
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  const current = setScenario('pending', 'success')
  current.concurrentBarrier = { wait, release }

  await Promise.all([post!(request()), post!(request())])

  assert.deepEqual(
    {
      dispatchCount: current.dispatchCount,
      updatedStatuses: current.updates.map((update) => update.status),
    },
    { dispatchCount: 1, updatedStatuses: ['messaged'] }
  )
})
