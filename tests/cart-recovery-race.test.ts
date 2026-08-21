import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

type SendMode = 'success' | 'failure' | 'throw'
type Row = Record<string, unknown>
type QueryResult = { data: unknown; error: null }

class Deferred<T = void> {
  promise: Promise<T>
  resolve!: (value: T | PromiseLike<T>) => void

  constructor() {
    this.promise = new Promise<T>((resolve) => {
      this.resolve = resolve
    })
  }
}

class HermeticSupabase {
  cart: Row = {}
  store: Row = {}
  analytics: Row[] = []
  claimApplied = new Deferred()
  allowClaimResponse = new Deferred()

  reset(customerPhone: string | null) {
    this.cart = {
      id: 'cart-race',
      store_id: 'store-1',
      shopify_cart_token: 'checkout-token',
      customer_phone: customerPhone,
      customer_email: 'buyer@example.test',
      customer_name: 'Test Buyer',
      cart_value: 42,
      items: [{ title: 'Test item', quantity: 1, price: '42' }],
      checkout_url: 'https://shop.example.test/checkouts/checkout-token',
      status: 'pending',
      created_at: '2026-08-21T10:00:00.000Z',
      updated_at: '2026-08-21T10:00:00.000Z',
    }
    this.store = {
      id: 'store-1',
      shopify_domain: 'shop.example.test',
      shopify_access_token: null,
    }
    this.analytics = []
    this.claimApplied = new Deferred()
    this.allowClaimResponse = new Deferred()
  }

  from(table: string) {
    return new HermeticQuery(this, table)
  }

  rows(table: string): Row[] {
    if (table === 'abandoned_carts') return [this.cart]
    if (table === 'stores') return [this.store]
    if (table === 'analytics_daily') return this.analytics
    if (table === 'messages') return []
    throw new Error(`Unexpected table in hermetic Supabase: ${table}`)
  }
}

class HermeticQuery implements PromiseLike<QueryResult> {
  private action: 'select' | 'update' | 'insert' = 'select'
  private values: Row | Row[] | null = null
  private selectedColumns: string | null = null
  private filters: Array<
    | { kind: 'eq'; column: string; value: unknown }
    | { kind: 'in'; column: string; value: unknown[] }
  > = []
  private rowLimit: number | null = null
  private execution: Promise<QueryResult> | null = null

  constructor(
    private readonly database: HermeticSupabase,
    private readonly table: string
  ) {}

  select(columns = '*') {
    this.selectedColumns = columns
    return this
  }

  update(values: Row) {
    this.action = 'update'
    this.values = values
    return this
  }

  insert(values: Row | Row[]) {
    this.action = 'insert'
    this.values = values
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: 'eq', column, value })
    return this
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ kind: 'in', column, value })
    return this
  }

  order() {
    return this
  }

  limit(value: number) {
    this.rowLimit = value
    return this
  }

  async single() {
    return this.execute(true)
  }

  async maybeSingle() {
    return this.execute(true)
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute(false).then(onfulfilled, onrejected)
  }

  private matches(row: Row) {
    return this.filters.every((filter) => {
      if (filter.kind === 'eq') return row[filter.column] === filter.value
      return filter.value.includes(row[filter.column])
    })
  }

  private project(row: Row) {
    if (!this.selectedColumns || this.selectedColumns === '*') return { ...row }
    const columns = this.selectedColumns.split(',').map((column) => column.trim())
    return Object.fromEntries(columns.map((column) => [column, row[column]]))
  }

  private execute(single: boolean): Promise<QueryResult> {
    if (this.execution) return this.execution
    this.execution = this.run(single)
    return this.execution
  }

  private async run(single: boolean): Promise<QueryResult> {
    if (this.action === 'insert') {
      const inserted = Array.isArray(this.values) ? this.values : [this.values ?? {}]
      this.database.rows(this.table).push(...inserted.map((row) => ({ ...row })))
      const data = this.selectedColumns ? inserted.map((row) => this.project(row)) : null
      return { data: single ? data?.[0] ?? null : data, error: null }
    }

    let rows = this.database.rows(this.table).filter((row) => this.matches(row))
    if (this.rowLimit !== null) rows = rows.slice(0, this.rowLimit)

    if (this.action === 'update') {
      const statusPredicate = this.filters.find(
        (filter) => filter.kind === 'eq' && filter.column === 'status'
      )
      const isClaim =
        this.table === 'abandoned_carts' &&
        this.values?.status === 'messaged' &&
        statusPredicate?.value === 'pending'

      for (const row of rows) {
        Object.assign(row, this.values)
      }

      if (isClaim && rows.length > 0) {
        this.database.claimApplied.resolve()
        await this.database.allowClaimResponse.promise
      }
    }

    const data = rows.map((row) => this.project(row))
    return { data: single ? data[0] ?? null : data, error: null }
  }
}

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(testDirectory, '..')
const moduleUrl = (relativePath: string) =>
  pathToFileURL(path.join(workspaceRoot, relativePath)).href

const database = new HermeticSupabase()
let sendMode: SendMode = 'success'

mock.module(moduleUrl('lib/supabase.ts'), {
  namedExports: {
    supabaseAdmin: database,
    getSupabaseAdmin: () => database,
  },
})

mock.module(moduleUrl('lib/recovery-link.ts'), {
  namedExports: {
    getTrackedRecoveryUrl: (cartId: string) =>
      `https://app.example.test/r/${cartId}`,
  },
})

mock.module(moduleUrl('lib/services/twilio-whatsapp.ts'), {
  namedExports: {
    buildAbandonedCartContentVariables: () => ({ '1': 'Test Buyer' }),
    buildRecoveryWhatsAppBody: () => 'Hermetic recovery message',
    getTwilioAbandonedCartContentSid: () => 'HX_TEST',
    hasTwilioWhatsAppCredentials: () => true,
    isValidWhatsAppPhone: (phone: string) => !phone.includes('5551212'),
    resolveRecoveryCustomerName: (name: string | null) => name || 'there',
    sendTwilioWhatsAppMessage: async () => {
      if (sendMode === 'throw') throw new Error('hermetic Twilio exception')
      if (sendMode === 'failure') {
        return { success: false, error: 'hermetic Twilio failure' }
      }
      return { success: true, messageSid: 'SM_HERMETIC' }
    },
  },
})

process.env.NODE_ENV = 'test'

const scenarios: Array<{
  name: string
  phone: string | null
  sendMode: SendMode
}> = [
  {
    name: 'missing phone release',
    phone: null,
    sendMode: 'success',
  },
  {
    name: 'invalid phone finalization',
    phone: '+15551212',
    sendMode: 'success',
  },
  {
    name: 'send failure release',
    phone: '+14155550123',
    sendMode: 'failure',
  },
  {
    name: 'send exception catch release',
    phone: '+14155550123',
    sendMode: 'throw',
  },
  {
    name: 'send success finalization',
    phone: '+14155550123',
    sendMode: 'success',
  },
]

test('preserves recovered status when cart recovery cron finishes after an order webhook', async () => {
  const { GET: runCartRecoveryCron } = await import(
    moduleUrl('app/api/cart-recovery/route.ts')
  )
  const { POST: runShopifyWebhook } = await import(
    moduleUrl('app/api/webhooks/shopify/route.ts')
  )

  for (const scenario of scenarios) {
    database.reset(scenario.phone)
    sendMode = scenario.sendMode

    const cronPromise = runCartRecoveryCron(
      new Request('http://localhost/api/cart-recovery') as never
    )

    await database.claimApplied.promise
    assert.equal(database.cart.status, 'messaged')

    const webhookResponse = await runShopifyWebhook(
      new Request('http://localhost/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shopify-shop-domain': 'shop.example.test',
          'x-shopify-topic': 'orders/paid',
          'x-shopify-webhook-skip-verify': 'true',
        },
        body: JSON.stringify({
          id: 'order-1',
          cart_token: 'checkout-token',
          customer: {},
        }),
      }) as never
    )

    assert.equal(webhookResponse.status, 200)
    assert.equal(
      database.cart.status,
      'recovered',
      `${scenario.name}: order webhook must win before cron resumes`
    )

    database.allowClaimResponse.resolve()
    const cronResponse = await cronPromise
    assert.equal(cronResponse.status, 200)

    assert.equal(
      database.cart.status,
      'recovered',
      `${scenario.name}: recovered status must remain terminal after cron resumes`
    )
  }
})
