import { supabaseAdmin } from "@/lib/supabase"
import { PrivacyDbError } from "@/lib/privacy/compliance-errors"
import type {
  PrivacyCart,
  PrivacyDb,
  PrivacyMessage,
  PrivacySuppression,
  StoreScopedTable,
} from "@/lib/privacy/compliance"
import { anonymizedCartUpdate, anonymizedMessageUpdate } from "@/lib/privacy/compliance"

const MISSING_COLUMN = new Set(["42703", "PGRST204"])

/** PostgREST returns at most this many rows unless the caller pages. */
export const CART_PAGE_SIZE = 1000

const CART_COLUMNS =
  "id, customer_email, customer_phone, customer_name, checkout_url, status, created_at"

export async function listStoreCarts(
  storeId: string,
  fetchPage: (
    storeId: string,
    from: number,
    to: number
  ) => Promise<{ data: unknown; error: unknown }>
): Promise<PrivacyCart[]> {
  const carts: PrivacyCart[] = []
  let from = 0
  for (;;) {
    const to = from + CART_PAGE_SIZE - 1
    const { data, error } = await fetchPage(storeId, from, to)
    throwIf(error)
    const raw = rowsOf(data)
    carts.push(...raw.map(cartFrom).filter((cart) => cart.id))
    if (raw.length < CART_PAGE_SIZE) return carts
    from += CART_PAGE_SIZE
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
  if (code) throw new PrivacyDbError(code)
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function rowsOf(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return []
  return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
}

function cartFrom(row: Record<string, unknown>): PrivacyCart {
  return {
    id: text(row.id) ?? "",
    customerEmail: text(row.customer_email),
    customerPhone: text(row.customer_phone),
    customerName: text(row.customer_name),
    checkoutUrl: text(row.checkout_url),
    status: text(row.status),
    createdAt: text(row.created_at),
  }
}

function messageFrom(row: Record<string, unknown>): PrivacyMessage {
  return {
    id: text(row.id) ?? "",
    cartId: text(row.cart_id) ?? "",
    phone: text(row.phone),
    email: text(row.email),
    body: text(row.body),
    templateName: text(row.template_name),
    status: text(row.status),
    createdAt: text(row.created_at),
    sentAt: text(row.sent_at),
  }
}

function suppressionFrom(row: Record<string, unknown>): PrivacySuppression {
  return {
    id: text(row.id) ?? "",
    email: text(row.email) ?? "",
    storeId: text(row.store_id),
  }
}

export function createSupabasePrivacyDb(client: typeof supabaseAdmin = supabaseAdmin): PrivacyDb {
  return {
    async findStoreId(shopDomain) {
      if (!shopDomain || /[%_]/.test(shopDomain)) return null
      const { data, error } = await client
        .from("stores")
        .select("id")
        .ilike("shopify_domain", shopDomain)
        .limit(1)
      throwIf(error)
      return text(rowsOf(data)[0]?.id)
    },

    async listCarts(storeId) {
      return listStoreCarts(storeId, async (scopedStoreId, from, to) => {
        const result = await client
          .from("abandoned_carts")
          .select(CART_COLUMNS)
          .eq("store_id", scopedStoreId)
          .order("id", { ascending: true })
          .range(from, to)
        return { data: result.data, error: result.error }
      })
    },

    async anonymizeCart(storeId, cartId, replacementToken) {
      const { error } = await client
        .from("abandoned_carts")
        .update(anonymizedCartUpdate(replacementToken))
        .eq("id", cartId)
        .eq("store_id", storeId)
      throwIf(error)
    },

    async listMessagesForCarts(storeId, cartIds, includeEmail) {
      if (cartIds.length === 0) return []
      const withEmail =
        "id, cart_id, phone, email, body, template_name, status, created_at, sent_at"
      const withoutEmail = "id, cart_id, phone, body, template_name, status, created_at, sent_at"
      const columns = includeEmail ? withEmail : withoutEmail
      const { data, error } = await client
        .from("messages")
        .select(columns)
        .eq("store_id", storeId)
        .in("cart_id", cartIds)
      if (error && includeEmail && MISSING_COLUMN.has(errorCode(error) ?? "")) {
        const retry = await client
          .from("messages")
          .select(withoutEmail)
          .eq("store_id", storeId)
          .in("cart_id", cartIds)
        throwIf(retry.error)
        return rowsOf(retry.data).map(messageFrom)
      }
      throwIf(error)
      return rowsOf(data).map(messageFrom)
    },

    async anonymizeMessages(storeId, cartId, includeEmail) {
      const patch = anonymizedMessageUpdate(includeEmail)
      const first = await client
        .from("messages")
        .update(patch)
        .eq("store_id", storeId)
        .eq("cart_id", cartId)
        .select("id")
      if (first.error && includeEmail && MISSING_COLUMN.has(errorCode(first.error) ?? "")) {
        const second = await client
          .from("messages")
          .update(anonymizedMessageUpdate(false))
          .eq("store_id", storeId)
          .eq("cart_id", cartId)
          .select("id")
        throwIf(second.error)
        return rowsOf(second.data).length
      }
      throwIf(first.error)
      return rowsOf(first.data).length
    },

    async listSuppressionsForStore(storeId) {
      const { data, error } = await client
        .from("email_suppressions")
        .select("id, email, store_id")
        .eq("store_id", storeId)
      throwIf(error)
      return rowsOf(data)
        .map(suppressionFrom)
        .filter((row) => row.id && row.email)
    },

    async listSuppressionsByEmail(emails) {
      if (emails.length === 0) return []
      const { data, error } = await client
        .from("email_suppressions")
        .select("id, email, store_id")
        .in("email", emails)
      throwIf(error)
      return rowsOf(data)
        .map(suppressionFrom)
        .filter((row) => row.id && row.email)
    },

    async updateSuppression(id, email, storeId) {
      const { error } = await client
        .from("email_suppressions")
        .update({ email, store_id: storeId })
        .eq("id", id)
      const code = errorCode(error)
      if (code === "23505") return "duplicate"
      if (code) throw new PrivacyDbError(code)
      return "updated"
    },

    async deleteSuppression(id) {
      const { error } = await client.from("email_suppressions").delete().eq("id", id)
      throwIf(error)
    },

    async deleteStoreScoped(table: StoreScopedTable, storeId) {
      const { error } = await client.from(table).delete().eq("store_id", storeId)
      throwIf(error)
    },

    async deleteStore(storeId) {
      const { error } = await client.from("stores").delete().eq("id", storeId)
      throwIf(error)
    },
  }
}
