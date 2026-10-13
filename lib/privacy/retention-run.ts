import { brand } from "@/lib/brand"
import {
  anonymizedRetentionCart,
  applyRetention,
  isRetentionDryRun,
  RETENTION_ANY_MS,
  RETENTION_CART_COLUMNS,
  RETENTION_TERMINAL_MS,
  RETENTION_URL_MS,
  retentionBatchSize,
  retentionMessagePatch,
  type RetentionCart,
  type RetentionCounts,
} from "@/lib/privacy/retention"
import { supabaseAdmin } from "@/lib/supabase"

const MISSING_COLUMN = new Set(["42703", "PGRST204"])
const PII_FILTER =
  "customer_phone.not.is.null,customer_email.not.is.null,customer_name.not.is.null,checkout_url.not.is.null,last_send_error.not.is.null"

class RetentionDbError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = "RetentionDbError"
    this.code = code
  }
}

export function retentionErrorCode(error: unknown): string {
  return error instanceof RetentionDbError ? error.code : "failed"
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function rowsOf(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return []
  return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
}

function cartFrom(row: Record<string, unknown>): RetentionCart {
  return {
    id: text(row.id) ?? "",
    storeId: text(row.store_id) ?? "",
    status: text(row.status),
    createdAt: text(row.created_at),
    messageSentAt: text(row.message_sent_at),
    recoveryCompletedAt: text(row.recovery_completed_at),
    lastSendFailedAt: text(row.last_send_failed_at),
    customerPhone: text(row.customer_phone),
    customerEmail: text(row.customer_email),
    customerName: text(row.customer_name),
    checkoutUrl: text(row.checkout_url),
    lastSendError: text(row.last_send_error),
    items: row.items ?? [],
  }
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null
  if (!("code" in error)) return "db_error"
  const code = error.code
  return typeof code === "string" && code ? code : "db_error"
}

function throwIf(error: unknown): void {
  const code = errorCode(error)
  if (code) throw new RetentionDbError(code)
}

type CartQuery = {
  not(column: string, operator: string, value: null): CartQuery
  lt(column: string, value: string): CartQuery
  eq(column: string, value: string): CartQuery
  is(column: string, value: null): CartQuery
  in(column: string, values: string[]): CartQuery
  or(filters: string): CartQuery
  limit(count: number): PromiseLike<{ data: unknown; error: unknown }>
}

function cartQuery(): CartQuery {
  return supabaseAdmin.from("abandoned_carts").select(RETENTION_CART_COLUMNS) as unknown as CartQuery
}

async function selectCarts(build: (query: CartQuery) => CartQuery, limit: number): Promise<RetentionCart[]> {
  if (limit <= 0) return []
  const query = cartQuery()
  const { data, error } = await build(query).limit(limit)
  throwIf(error)
  return rowsOf(data)
    .map(cartFrom)
    .filter((cart) => cart.id && cart.storeId)
}

export async function loadRetentionCarts(now: number, limit: number): Promise<RetentionCart[]> {
  const seven = new Date(now - RETENTION_URL_MS).toISOString()
  const thirty = new Date(now - RETENTION_TERMINAL_MS).toISOString()
  const ninety = new Date(now - RETENTION_ANY_MS).toISOString()
  const found = new Map<string, RetentionCart>()

  const add = async (build: (query: CartQuery) => CartQuery) => {
    const room = limit - found.size
    if (room <= 0) return
    for (const cart of await selectCarts(build, room)) found.set(cart.id, cart)
  }

  await add((query) => query.not("checkout_url", "is", null).lt("created_at", seven))
  await add((query) => query.lt("created_at", ninety).or(PII_FILTER))
  await add((query) =>
    query.eq("status", "messaged").lt("message_sent_at", thirty).or(PII_FILTER)
  )
  await add((query) =>
    query.eq("status", "messaged").is("message_sent_at", null).lt("created_at", thirty).or(PII_FILTER)
  )
  await add((query) =>
    query.eq("status", "recovered").lt("recovery_completed_at", thirty).or(PII_FILTER)
  )
  await add((query) =>
    query.eq("status", "recovered").is("recovery_completed_at", null).lt("created_at", thirty).or(PII_FILTER)
  )
  await add((query) =>
    query.in("status", ["lost", "skipped"]).lt("last_send_failed_at", thirty).or(PII_FILTER)
  )
  await add((query) =>
    query
      .in("status", ["lost", "skipped"])
      .is("last_send_failed_at", null)
      .lt("created_at", thirty)
      .or(PII_FILTER)
  )

  return [...found.values()]
}

async function clearMessages(cart: RetentionCart, includeEmail: boolean): Promise<void> {
  const patch = retentionMessagePatch(includeEmail)
  const first = await supabaseAdmin
    .from("messages")
    .update(patch)
    .eq("cart_id", cart.id)
    .eq("store_id", cart.storeId)
  if (first.error && includeEmail && MISSING_COLUMN.has(errorCode(first.error) ?? "")) {
    const second = await supabaseAdmin
      .from("messages")
      .update(retentionMessagePatch(false))
      .eq("cart_id", cart.id)
      .eq("store_id", cart.storeId)
    throwIf(second.error)
    return
  }
  throwIf(first.error)
}

export async function runDataRetention(now = Date.now()): Promise<RetentionCounts> {
  const dryRun = isRetentionDryRun(process.env.RETENTION_DRY_RUN)
  const limit = retentionBatchSize(process.env.RETENTION_BATCH_SIZE)
  const carts = await loadRetentionCarts(now, limit)
  const includeEmail = !brand.isDefault
  return applyRetention({
    carts,
    now,
    dryRun,
    writeCart: async (cart, action) => {
      const patch =
        action === "anonymize" ? anonymizedRetentionCart(cart.items) : { checkout_url: null }
      const { error } = await supabaseAdmin
        .from("abandoned_carts")
        .update(patch)
        .eq("id", cart.id)
        .eq("store_id", cart.storeId)
      throwIf(error)
    },
    writeMessages: async (cart) => {
      await clearMessages(cart, includeEmail)
    },
  })
}
