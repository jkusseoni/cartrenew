import assert from 'node:assert/strict'
import test from 'node:test'

import { supabaseAdmin } from '@/lib/supabase'
import { processFirstAttempts } from '@/lib/services/recovery-dispatch'

type Row = Record<string, unknown>

test('phone-less carts do not consume first-attempt slots', async (t) => {
  const carts: Row[] = [
    ...Array.from({ length: 25 }, (_, index) => ({
      id: `missing-${index + 1}`,
      store_id: 'store-1',
      customer_phone: null,
      customer_name: null,
      checkout_url: null,
      status: 'pending',
      created_at: '2026-10-08T10:00:00.000Z',
      updated_at: `2026-10-08T10:00:${String(index).padStart(2, '0')}.000Z`,
      processing_started_at: null,
    })),
    {
      id: 'valid-26',
      store_id: 'store-1',
      customer_phone: '+14155552671',
      customer_name: 'Valid',
      checkout_url: 'https://shop.example/checkout',
      status: 'pending',
      created_at: '2026-10-08T10:01:00.000Z',
      updated_at: '2026-10-08T10:01:00.000Z',
      processing_started_at: null,
    },
  ]
  const messages: Row[] = []
  const queriedFilters: string[] = []
  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin)
  const originalFetch = global.fetch
  const originalToken = process.env.WHATSAPP_ACCESS_TOKEN
  const originalPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID

  process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token'
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456'
  global.fetch = async () =>
    new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  t.after(() => {
    ;(supabaseAdmin as unknown as { from: typeof supabaseAdmin.from }).from = originalFrom
    global.fetch = originalFetch
    if (originalToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN
    else process.env.WHATSAPP_ACCESS_TOKEN = originalToken
    if (originalPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID
    else process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneId
  })

  ;(supabaseAdmin as unknown as { from: (table: string) => unknown }).from = (
    table: string
  ) => {
    let operation: 'select' | 'insert' | 'update' = 'select'
    let values: Row = {}
    const equals: Array<[string, unknown]> = []
    const notNull = new Set<string>()
    const notEqual: Array<[string, unknown]> = []
    const included: Array<[string, unknown[]]> = []
    let ordering: { column: string; ascending: boolean } | null = null

    const source = table === 'abandoned_carts' ? carts : messages
    const matchingRows = () => {
      let rows = source.filter(
        (row) =>
          equals.every(([column, value]) => row[column] === value) &&
          [...notNull].every((column) => row[column] !== null) &&
          notEqual.every(([column, value]) => row[column] !== value) &&
          included.every(([column, values]) => values.includes(row[column]))
      )
      if (ordering) {
        rows = [...rows].sort((a, b) => {
          const compared = String(a[ordering!.column]).localeCompare(
            String(b[ordering!.column])
          )
          return ordering!.ascending ? compared : -compared
        })
      }
      return rows
    }

    const execute = async (limit?: number, single = false) => {
      if (operation === 'insert') {
        const inserted = { id: `message-${messages.length + 1}`, ...values }
        messages.push(inserted)
        return { data: single ? inserted : [inserted], error: null }
      }

      let rows = matchingRows()
      if (operation === 'update') {
        rows.forEach((row) => Object.assign(row, values))
      }
      if (limit !== undefined) rows = rows.slice(0, limit)
      return { data: single ? rows[0] ?? null : rows, error: null }
    }

    const query: Record<string, unknown> = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        equals.push([column, value])
        return query
      },
      not: (column: string, operator: string, value: unknown) => {
        queriedFilters.push(`${column}.${operator}.${String(value)}`)
        if (operator === 'is' && value === null) notNull.add(column)
        return query
      },
      neq: (column: string, value: unknown) => {
        queriedFilters.push(`${column}.neq.${String(value)}`)
        notEqual.push([column, value])
        return query
      },
      gte: () => query,
      or: () => query,
      in: (column: string, valuesToInclude: unknown[]) => {
        included.push([column, valuesToInclude])
        return query
      },
      order: (column: string, options: { ascending: boolean }) => {
        ordering = { column, ascending: options.ascending }
        return query
      },
      limit: (limit: number) => execute(limit),
      insert: (row: Row) => {
        operation = 'insert'
        values = row
        return query
      },
      update: (row: Row) => {
        operation = 'update'
        values = row
        return query
      },
      single: () => execute(undefined, true),
      then: (
        resolve: (value: { data: Row[]; error: null }) => unknown,
        reject: (reason: unknown) => unknown
      ) => execute().then(resolve, reject),
    }
    return query
  }

  const results = await processFirstAttempts({ limit: 25 })

  assert.deepEqual(
    queriedFilters,
    ['customer_phone.is.null', 'customer_phone.neq.']
  )
  assert.equal(results.length, 1)
  assert.equal(results[0]?.cartId, 'valid-26')
  assert.equal(results[0]?.outcome, 'sent')
  assert.equal(messages.length, 1)
  assert.equal(carts.filter((cart) => cart.status === 'pending').length, 25)
  assert.ok(carts.every((cart) => !String(cart.id).startsWith('missing-') || cart.processing_started_at === null))
})
