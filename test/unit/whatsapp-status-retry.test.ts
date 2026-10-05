import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'

type Row = Record<string, unknown>
type TableName = 'messages' | 'abandoned_carts'
type Database = Record<TableName, Row[]>

class MockQuery implements PromiseLike<{ data: Row[] | Row | null; error: null }> {
  private operation: 'select' | 'update' = 'select'
  private updateValues: Row = {}
  private selectedColumns: string | null = null
  private predicates: Array<(row: Row) => boolean> = []
  private rowLimit: number | null = null

  constructor(
    private readonly database: Database,
    private readonly table: TableName
  ) {}

  update(values: Row) {
    this.operation = 'update'
    this.updateValues = values
    return this
  }

  select(columns: string) {
    this.selectedColumns = columns
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

  lt(column: string, value: string) {
    this.predicates.push((row) => typeof row[column] === 'string' && row[column] < value)
    return this
  }

  is(column: string, value: null) {
    this.predicates.push((row) => row[column] === value)
    return this
  }

  or(expression: string) {
    const dueAt = expression
      .split(',')
      .find((part) => part.startsWith('next_retry_at.lte.'))
      ?.slice('next_retry_at.lte.'.length)
    this.predicates.push(
      (row) =>
        row.next_retry_at == null ||
        (typeof row.next_retry_at === 'string' && !!dueAt && row.next_retry_at <= dueAt)
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

  then<TResult1 = { data: Row[] | Row | null; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row[] | Row | null; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private project(row: Row): Row {
    if (!this.selectedColumns) return { ...row }
    const columns = this.selectedColumns.split(',').map((column) => column.trim())
    return Object.fromEntries(columns.map((column) => [column, row[column]]))
  }

  private async execute(): Promise<{ data: Row[] | null; error: null }> {
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

let database: Database
let originalFrom: (table: string) => unknown
let originalFetch: typeof fetch
let originalAccessToken: string | undefined
let originalPhoneNumberId: string | undefined
let applyStatusEvent: typeof import('../../lib/services/whatsapp-status-sync').applyStatusEvent
let processDueRetries: typeof import('../../lib/services/recovery-dispatch').processDueRetries

function acceptedFixture(attemptCount = 1): Database {
  const now = new Date().toISOString()
  return {
    messages: [
      {
        id: 'message-test',
        cart_id: 'cart-test',
        status: 'sent',
        phone: '+14155552671',
        attempt_count: attemptCount,
        next_retry_at: null,
        whatsapp_message_id: 'wamid.status-test',
        created_at: now,
      },
    ],
    abandoned_carts: [
      {
        id: 'cart-test',
        status: 'messaged',
        customer_name: 'Synthetic',
        checkout_url: 'https://example.test/recovery',
        message_sent_at: now,
        message_delivered_at: null,
        message_read_at: null,
        last_send_error: null,
        last_send_failed_at: null,
      },
    ],
  }
}

function failedEvent() {
  return {
    whatsappMessageId: 'wamid.status-test',
    status: 'failed' as const,
    occurredAt: new Date().toISOString(),
    error: '131026: Message undeliverable',
  }
}

before(async () => {
  const { supabaseAdmin } = await import('../../lib/supabase')
  const mutableClient = supabaseAdmin as unknown as {
    from: (table: string) => unknown
  }
  originalFrom = mutableClient.from
  mutableClient.from = (table) => new MockQuery(database, table as TableName)

  ;({ applyStatusEvent } = await import('../../lib/services/whatsapp-status-sync'))
  ;({ processDueRetries } = await import('../../lib/services/recovery-dispatch'))

  originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ messages: [{ id: 'wamid.retry-success' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch

  originalAccessToken = process.env.WHATSAPP_ACCESS_TOKEN
  originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  process.env.WHATSAPP_ACCESS_TOKEN = 'synthetic-test-token'
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'synthetic-phone-number-id'
})

after(async () => {
  const { supabaseAdmin } = await import('../../lib/supabase')
  const mutableClient = supabaseAdmin as unknown as {
    from: (table: string) => unknown
  }
  mutableClient.from = originalFrom
  globalThis.fetch = originalFetch
  if (originalAccessToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN
  else process.env.WHATSAPP_ACCESS_TOKEN = originalAccessToken
  if (originalPhoneNumberId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID
  else process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId
})

beforeEach(() => {
  database = acceptedFixture()
})

test('a failed accepted message becomes retry-eligible and the retry worker resends it', async () => {
  assert.equal(await applyStatusEvent(failedEvent()), 'updated')

  const message = database.messages[0]
  const cart = database.abandoned_carts[0]
  assert.equal(message.status, 'pending')
  assert.equal(cart.status, 'pending')
  assert.equal(message.attempt_count, 1)
  assert.match(String(message.error_message), /^meta_status_failed:/)
  assert.ok(Date.parse(String(message.next_retry_at)) > Date.now())

  message.next_retry_at = new Date(Date.now() - 1_000).toISOString()
  const run = await processDueRetries({ limit: 1 })

  assert.deepEqual(run.results.map(({ outcome }) => outcome), ['sent'])
  assert.equal(message.status, 'sent')
  assert.equal(message.attempt_count, 2)
  assert.equal(message.whatsapp_message_id, 'wamid.retry-success')
  assert.equal(cart.status, 'messaged')
})

test('a failed callback at the attempt cap terminalizes the message and cart', async () => {
  database = acceptedFixture(3)

  assert.equal(await applyStatusEvent(failedEvent()), 'updated')
  assert.equal(database.messages[0].status, 'failed')
  assert.equal(database.messages[0].next_retry_at, null)
  assert.equal(database.abandoned_carts[0].status, 'lost')
  assert.deepEqual(await processDueRetries({ limit: 1 }), { expired: 0, results: [] })
})

test('a duplicate failed callback is idempotent and does not postpone the retry', async () => {
  assert.equal(await applyStatusEvent(failedEvent()), 'updated')
  const stateAfterFirst = structuredClone(database)

  assert.equal(await applyStatusEvent(failedEvent()), 'no_change')
  assert.deepEqual(database, stateAfterFirst)
})

test('a delayed sent callback cannot strand a retry-pending message', async () => {
  assert.equal(await applyStatusEvent(failedEvent()), 'updated')
  database.messages[0].next_retry_at = new Date(Date.now() - 1_000).toISOString()

  assert.equal(
    await applyStatusEvent({
      whatsappMessageId: 'wamid.status-test',
      status: 'sent',
      occurredAt: new Date().toISOString(),
      error: null,
    }),
    'no_change'
  )
  assert.equal(database.messages[0].status, 'pending')
  assert.equal(database.abandoned_carts[0].status, 'pending')

  const run = await processDueRetries({ limit: 1 })
  assert.deepEqual(run.results.map(({ outcome }) => outcome), ['sent'])
  assert.equal(database.messages[0].status, 'sent')
  assert.equal(database.messages[0].attempt_count, 2)
  assert.equal(database.messages[0].whatsapp_message_id, 'wamid.retry-success')
  assert.equal(database.abandoned_carts[0].status, 'messaged')
})

test('duplicate failed callbacks repair message-first partial cart updates', async () => {
  const reason = 'meta_status_failed: 131026: Message undeliverable'
  database.messages[0].status = 'pending'
  database.messages[0].error_message = reason
  database.messages[0].next_retry_at = new Date(Date.now() + 60_000).toISOString()

  assert.equal(await applyStatusEvent(failedEvent()), 'no_change')
  assert.equal(database.messages[0].status, 'pending')
  assert.equal(database.abandoned_carts[0].status, 'pending')

  database = acceptedFixture(3)
  database.messages[0].status = 'failed'
  database.messages[0].error_message = reason

  assert.equal(await applyStatusEvent(failedEvent()), 'no_change')
  assert.equal(database.messages[0].status, 'failed')
  assert.equal(database.abandoned_carts[0].status, 'lost')
})

test('a duplicate sent callback repairs accepted-send partial cart state', async () => {
  database.abandoned_carts[0].status = 'pending'

  assert.equal(
    await applyStatusEvent({
      whatsappMessageId: 'wamid.status-test',
      status: 'sent',
      occurredAt: new Date().toISOString(),
      error: null,
    }),
    'no_change'
  )
  assert.equal(database.messages[0].status, 'sent')
  assert.equal(database.abandoned_carts[0].status, 'messaged')
  assert.deepEqual(await processDueRetries({ limit: 1 }), { expired: 0, results: [] })
})

test('delivered and read callbacks after a failed callback cancel retry state', async () => {
  assert.equal(await applyStatusEvent(failedEvent()), 'updated')
  assert.equal(database.messages[0].status, 'pending')
  assert.equal(database.abandoned_carts[0].status, 'pending')

  const deliveredAt = new Date(Date.now() + 1_000).toISOString()
  assert.equal(
    await applyStatusEvent({
      whatsappMessageId: 'wamid.status-test',
      status: 'delivered',
      occurredAt: deliveredAt,
      error: null,
    }),
    'updated'
  )
  assert.equal(database.messages[0].status, 'delivered')
  assert.equal(database.abandoned_carts[0].status, 'messaged')
  assert.equal(database.abandoned_carts[0].message_delivered_at, deliveredAt)

  const readAt = new Date(Date.now() + 2_000).toISOString()
  assert.equal(
    await applyStatusEvent({
      whatsappMessageId: 'wamid.status-test',
      status: 'read',
      occurredAt: readAt,
      error: null,
    }),
    'updated'
  )
  assert.equal(database.messages[0].status, 'read')
  assert.equal(database.abandoned_carts[0].status, 'messaged')
  assert.equal(database.abandoned_carts[0].message_read_at, readAt)
  assert.deepEqual(await processDueRetries({ limit: 1 }), { expired: 0, results: [] })
})
