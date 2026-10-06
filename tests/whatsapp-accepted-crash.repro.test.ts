import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'

type Row = Record<string, unknown>
type TableName = 'stores' | 'messages' | 'abandoned_carts' | 'analytics_daily'
type Database = Record<TableName, Row[]>

class MockQuery implements PromiseLike<{ data: Row[] | Row | null; error: null }> {
  private operation: 'select' | 'update' | 'insert' = 'select'
  private selectedColumns: string | null = null
  private updateValues: Row = {}
  private insertValues: Row[] = []
  private predicates: Array<(row: Row) => boolean> = []
  private rowLimit: number | null = null

  constructor(
    private database: Database,
    private table: TableName
  ) {}

  select(columns = '*') {
    this.selectedColumns = columns
    return this
  }

  update(values: Row) {
    this.operation = 'update'
    this.updateValues = values
    return this
  }

  insert(values: Row | Row[]) {
    this.operation = 'insert'
    this.insertValues = (Array.isArray(values) ? values : [values]).map((row) => ({ ...row }))
    return this
  }

  eq(column: string, value: unknown) {
    this.predicates.push((row) => row[column] === value)
    return this
  }

  in(column: string, values: unknown[]) {
    this.predicates.push((row) => values.includes(row[column]))
    return this
  }

  gte(column: string, value: unknown) {
    this.predicates.push((row) => String(row[column]) >= String(value))
    return this
  }

  lt(column: string, value: unknown) {
    this.predicates.push((row) => String(row[column]) < String(value))
    return this
  }

  is(column: string, value: unknown) {
    this.predicates.push((row) => row[column] === value)
    return this
  }

  or(expression: string) {
    const dueAt = expression.match(/next_retry_at\.lte\.(.+)$/)?.[1]
    this.predicates.push(
      (row) => row.next_retry_at == null || Boolean(dueAt && String(row.next_retry_at) <= dueAt)
    )
    return this
  }

  order() {
    return this
  }

  limit(value: number) {
    this.rowLimit = value
    return this
  }

  async maybeSingle() {
    const result = await this.execute()
    const rows = Array.isArray(result.data) ? result.data : []
    return { data: rows[0] ?? null, error: null }
  }

  async single() {
    return this.maybeSingle()
  }

  then<TResult1 = { data: Row[] | Row | null; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row[] | Row | null; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private project(row: Row): Row {
    if (!this.selectedColumns || this.selectedColumns === '*') return { ...row }
    const columns = this.selectedColumns.split(',').map((column) => column.trim())
    return Object.fromEntries(columns.map((column) => [column, row[column]]))
  }

  private async execute(): Promise<{ data: Row[] | null; error: null }> {
    if (this.operation === 'insert') {
      const inserted = this.insertValues.map((row, index) => ({
        id: row.id ?? `inserted-${this.table}-${this.database[this.table].length + index + 1}`,
        created_at: row.created_at ?? new Date().toISOString(),
        ...row,
      }))
      this.database[this.table].push(...inserted)
      return {
        data: this.selectedColumns ? inserted.map((row) => this.project(row)) : null,
        error: null,
      }
    }

    let rows = this.database[this.table].filter((row) =>
      this.predicates.every((predicate) => predicate(row))
    )
    if (this.rowLimit != null) rows = rows.slice(0, this.rowLimit)

    if (this.operation === 'update') {
      for (const row of rows) Object.assign(row, this.updateValues)
      return {
        data: this.selectedColumns ? rows.map((row) => this.project(row)) : null,
        error: null,
      }
    }

    return { data: rows.map((row) => this.project(row)), error: null }
  }
}

const APP_SECRET = 'synthetic-app-secret'
const CART_ID = '00000000-0000-4000-8000-000000000001'
const STORE_ID = '00000000-0000-4000-8000-000000000002'
const ACCEPTED_WAMID = 'wamid.synthetic-accepted'

let database: Database
let originalFrom: (table: string) => unknown
let originalFetch: typeof fetch
let graphSendCount = 0
let whatsappPost: typeof import('../app/api/whatsapp/webhook/route').POST
let shopifyPost: typeof import('../app/api/webhooks/shopify/route').POST
let processDueRetries: typeof import('../lib/services/recovery-dispatch').processDueRetries
let processFirstAttempts: typeof import('../lib/services/recovery-dispatch').processFirstAttempts

function fixture(message: Row): Database {
  const now = new Date().toISOString()
  return {
    stores: [
      {
        id: STORE_ID,
        shopify_domain: 'synthetic-shop.example',
        shopify_access_token: null,
      },
    ],
    messages: [message],
    abandoned_carts: [
      {
        id: CART_ID,
        store_id: STORE_ID,
        shopify_cart_token: 'synthetic-cart-token',
        status: 'pending',
        customer_phone: '+447700900123',
        customer_email: 'synthetic@example.test',
        customer_name: 'Synthetic',
        cart_value: 25,
        items: [{ title: 'Synthetic item', quantity: 1, price: '25.00' }],
        checkout_url: 'https://example.test/checkouts/synthetic',
        message_sent_at: null,
        message_delivered_at: null,
        message_read_at: null,
        processing_started_at: now,
        created_at: now,
        updated_at: now,
      },
    ],
    analytics_daily: [],
  }
}

function signedMetaRequest(status: 'sent' | 'delivered' | 'read') {
  const body = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [
                {
                  id: ACCEPTED_WAMID,
                  status,
                  timestamp: '1791284400',
                },
              ],
            },
          },
        ],
      },
    ],
  })
  const signature = createHmac('sha256', APP_SECRET).update(body).digest('hex')
  return new NextRequest('http://localhost/api/whatsapp/webhook', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${signature}`,
    },
  })
}

function shopifyCartUpdateRequest() {
  const body = JSON.stringify({
    token: 'synthetic-cart-token',
    abandoned_checkout_url: 'https://example.test/checkouts/synthetic',
    currency: 'USD',
    customer: {
      first_name: 'Synthetic',
      email: 'synthetic@example.test',
      phone: '+447700900123',
    },
    shipping_address: { phone: '+447700900123' },
    line_items: [{ title: 'Synthetic item', quantity: 1, price: '25.00' }],
  })
  return new NextRequest('http://localhost/api/webhooks/shopify', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-shopify-shop-domain': 'synthetic-shop.example',
      'x-shopify-topic': 'carts/update',
      'x-shopify-webhook-skip-verify': 'true',
    },
  })
}

before(async () => {
  process.env.WHATSAPP_APP_SECRET = APP_SECRET
  process.env.WHATSAPP_ACCESS_TOKEN = 'synthetic-test-access-token'
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'synthetic-phone-number-id'

  const { supabaseAdmin } = await import('../lib/supabase')
  const mutableClient = supabaseAdmin as unknown as { from: (table: string) => unknown }
  originalFrom = mutableClient.from
  mutableClient.from = (table) => new MockQuery(database, table as TableName)

  ;({ POST: whatsappPost } = await import('../app/api/whatsapp/webhook/route'))
  ;({ POST: shopifyPost } = await import('../app/api/webhooks/shopify/route'))
  ;({ processDueRetries, processFirstAttempts } = await import('../lib/services/recovery-dispatch'))

  originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    graphSendCount += 1
    return new Response(
      JSON.stringify({ messages: [{ id: `wamid.synthetic-duplicate-${graphSendCount}` }] }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }) as typeof fetch
})

after(async () => {
  const { supabaseAdmin } = await import('../lib/supabase')
  const mutableClient = supabaseAdmin as unknown as { from: (table: string) => unknown }
  mutableClient.from = originalFrom
  globalThis.fetch = originalFetch
})

beforeEach(() => {
  graphSendCount = 0
})

test('signed delivery status leaves a correlatable accepted-send crash pending and Shopify resends', async () => {
  const now = new Date().toISOString()
  database = fixture({
    id: 'message-before-crash',
    cart_id: CART_ID,
    store_id: STORE_ID,
    phone: '+447700900123',
    template_name: 'abandoned_cart_reminder',
    status: 'sent',
    attempt_count: 1,
    next_retry_at: null,
    whatsapp_message_id: ACCEPTED_WAMID,
    sent_at: now,
    created_at: now,
  })

  const metaResponse = await whatsappPost(signedMetaRequest('delivered'))
  assert.equal(metaResponse.status, 200)
  assert.deepEqual(await metaResponse.json(), {
    success: true,
    statuses: 1,
    updated: 1,
    no_change: 0,
    unknown_message: 0,
    errors: 0,
  })

  assert.equal(database.messages[0].status, 'delivered')
  assert.equal(database.abandoned_carts[0].status, 'pending')
  assert.equal(database.abandoned_carts[0].message_delivered_at, '2026-10-06T11:00:00.000Z')
  assert.deepEqual(await processFirstAttempts({ limit: 25 }), [])
  assert.deepEqual(await processDueRetries({ limit: 25 }), { expired: 0, results: [] })

  const shopifyResponse = await shopifyPost(shopifyCartUpdateRequest())
  assert.equal(shopifyResponse.status, 200)
  assert.equal(graphSendCount, 1)
  assert.equal(database.messages.length, 2)
  assert.equal(database.messages[1].status, 'sent')
  assert.equal(database.abandoned_carts[0].status, 'messaged')

  console.log('REPRO_STATE correlatable', {
    afterMeta: 'message=delivered cart=pending',
    workers: 'no-op',
    afterShopifyUpdate: 'second_message=sent cart=messaged',
    graphSendCount,
  })
})

test('status webhook cannot correlate a crash before the accepted provider id is persisted', async () => {
  const now = new Date().toISOString()
  database = fixture({
    id: 'message-before-outcome',
    cart_id: CART_ID,
    store_id: STORE_ID,
    phone: '+447700900123',
    template_name: 'abandoned_cart_reminder',
    status: 'queued',
    attempt_count: 0,
    next_retry_at: null,
    whatsapp_message_id: null,
    sent_at: now,
    created_at: now,
  })

  const metaResponse = await whatsappPost(signedMetaRequest('sent'))
  assert.equal(metaResponse.status, 200)
  const result = await metaResponse.json()
  assert.equal(result.unknown_message, 1)
  assert.equal(database.messages[0].status, 'queued')
  assert.equal(database.abandoned_carts[0].status, 'pending')
  assert.deepEqual(await processFirstAttempts({ limit: 25 }), [])
  assert.deepEqual(await processDueRetries({ limit: 25 }), { expired: 0, results: [] })
  assert.equal(graphSendCount, 0)

  console.log('REPRO_STATE pre-outcome', {
    metaResult: 'unknown_message',
    message: 'queued_without_provider_id',
    cart: 'pending',
    workers: 'no-op_on_main',
  })
})
