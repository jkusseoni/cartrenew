import assert from 'node:assert/strict'

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

async function main() {
  const now = new Date().toISOString()
  const database: Database = {
    messages: [
      {
        id: 'message-repro',
        cart_id: 'cart-repro',
        status: 'queued',
        phone: '+15555550100',
        attempt_count: 0,
        next_retry_at: null,
        whatsapp_message_id: null,
        created_at: now,
      },
    ],
    abandoned_carts: [
      {
        id: 'cart-repro',
        status: 'pending',
        customer_name: 'Synthetic',
        checkout_url: 'https://example.test/recovery',
        message_sent_at: null,
        last_send_error: null,
        last_send_failed_at: null,
      },
    ],
  }

  const { supabaseAdmin } = await import('../lib/supabase')
  const mutableClient = supabaseAdmin as unknown as {
    from: (table: string) => unknown
  }
  const originalFrom = mutableClient.from
  mutableClient.from = (table) => new MockQuery(database, table as TableName)

  try {
    const { applyStatusEvent } = await import('../lib/services/whatsapp-status-sync')
    const { processDueRetries, recordAttemptOutcome } = await import(
      '../lib/services/recovery-dispatch'
    )

    await recordAttemptOutcome({
      messageId: 'message-repro',
      cartId: 'cart-repro',
      attemptsMade: 1,
      accepted: true,
      whatsappMessageId: 'wamid.synthetic-repro',
    })

    const message = database.messages[0]
    const cart = database.abandoned_carts[0]
    assert.equal(message.status, 'sent')
    assert.equal(cart.status, 'messaged')
    console.log('INITIAL_ACCEPTED', { messageStatus: message.status, cartStatus: cart.status })

    const applied = await applyStatusEvent({
      whatsappMessageId: 'wamid.synthetic-repro',
      status: 'failed',
      occurredAt: now,
      error: '131026: Message undeliverable',
    })

    assert.equal(applied, 'updated')
    assert.equal(message.status, 'failed')
    assert.equal(cart.status, 'messaged')
    console.log('AFTER_META_FAILED', {
      applyResult: applied,
      messageStatus: message.status,
      cartStatus: cart.status,
      nextRetryAt: message.next_retry_at,
    })

    const retryPass = await processDueRetries({ limit: 25 })
    assert.deepEqual(retryPass, { expired: 0, results: [] })
    console.log('RETRY_PASS', retryPass)

    message.status = 'pending'
    message.next_retry_at = new Date(Date.now() - 60_000).toISOString()
    const cartGateControl = await processDueRetries({ limit: 25 })
    assert.equal(cartGateControl.results[0]?.reason, 'cart_messaged')
    assert.equal(message.status, 'failed')
    assert.equal(cart.status, 'messaged')
    console.log('CONTROL_PENDING_MESSAGE_WITH_MESSAGED_CART', {
      result: cartGateControl.results[0],
      messageStatus: message.status,
      cartStatus: cart.status,
    })

    console.log('REPRO_CONFIRMED: Meta failure leaves no retry-eligible message/cart pair')
  } finally {
    mutableClient.from = originalFrom
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
