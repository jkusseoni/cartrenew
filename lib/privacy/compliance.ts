import { randomUUID } from "crypto"

import {
  isMissingSuppressionsTable,
  PrivacyConfigError,
  PrivacyDbError,
} from "@/lib/privacy/compliance-errors"
import { emailsMatch, phonesMatch } from "@/lib/privacy/customer-match"
import { isSuppressionHmac, suppressionHmac } from "@/lib/privacy/suppression-hash"

export type PrivacyCart = {
  id: string
  customerEmail: string | null
  customerPhone: string | null
  customerName: string | null
  checkoutUrl: string | null
  status: string | null
  createdAt: string | null
}

export type PrivacyMessage = {
  id: string
  cartId: string
  phone: string | null
  email: string | null
  body: string | null
  templateName: string | null
  status: string | null
  createdAt: string | null
  sentAt: string | null
}

export type PrivacySuppression = {
  id: string
  email: string
  storeId: string | null
}

export type StoreScopedTable =
  | "messages"
  | "abandoned_carts"
  | "message_templates"
  | "analytics_daily"

export type PrivacyDb = {
  findStoreId(shopDomain: string): Promise<string | null>
  listCarts(storeId: string): Promise<PrivacyCart[]>
  anonymizeCart(storeId: string, cartId: string, replacementToken: string): Promise<void>
  listMessagesForCarts(storeId: string, cartIds: string[], includeEmail: boolean): Promise<PrivacyMessage[]>
  anonymizeMessages(storeId: string, cartId: string, includeEmail: boolean): Promise<number>
  listSuppressionsForStore(storeId: string): Promise<PrivacySuppression[]>
  listSuppressionsByEmail(emails: string[]): Promise<PrivacySuppression[]>
  updateSuppression(id: string, email: string, storeId: string | null): Promise<"updated" | "duplicate">
  deleteSuppression(id: string): Promise<void>
  deleteStoreScoped(table: StoreScopedTable, storeId: string): Promise<void>
  deleteStore(storeId: string): Promise<void>
}

export type ComplianceLog = {
  requestId: string
  shopDomain: string
  topic: string
  carts: number
  messages: number
  suppressions: number
}

export type ComplianceInput = {
  topic: string
  shopDomain: string
  body: unknown
  requestId: string
  skipSuppressions: boolean
  hashSecret: string
  db: PrivacyDb
  log: (entry: ComplianceLog) => void
  deliverExport: (input: { requestId: string; shopDomain: string; body: string }) => Promise<void>
  replacementToken?: () => string
}

export function anonymizedCartUpdate(replacementToken: string) {
  return {
    customer_phone: null,
    customer_email: null,
    customer_name: null,
    checkout_url: null,
    shopify_cart_token: replacementToken,
    items: [] as unknown[],
    last_send_error: null,
  }
}

export function anonymizedMessageUpdate(includeEmail: boolean) {
  return {
    phone: null,
    body: null,
    error_message: null,
    ...(includeEmail ? { email: null } : {}),
  }
}

const SHOP_DELETE_ORDER: StoreScopedTable[] = [
  "messages",
  "abandoned_carts",
  "message_templates",
  "analytics_daily",
]

export function complianceTopic(topic: string): "customers/redact" | "customers/data_request" | "shop/redact" | null {
  if (topic.endsWith("customers/redact")) return "customers/redact"
  if (topic.endsWith("customers/data_request")) return "customers/data_request"
  if (topic.endsWith("shop/redact")) return "shop/redact"
  return null
}

export async function runCompliance(input: ComplianceInput): Promise<ComplianceLog> {
  const topic = complianceTopic(input.topic)
  const shopDomain = readShopDomain(input.shopDomain, input.body)
  const requestId = readRequestId(input.body, input.requestId)
  if (!topic || !shopDomain) {
    return finish(input, { requestId, shopDomain: shopDomain || "unknown", topic: topic ?? input.topic, carts: 0, messages: 0, suppressions: 0 })
  }

  const storeId = await input.db.findStoreId(shopDomain)
  if (!storeId) {
    return finish(input, { requestId, shopDomain, topic, carts: 0, messages: 0, suppressions: 0 })
  }

  if (topic === "customers/redact") {
    return finish(input, await redactCustomer(input, storeId, shopDomain, requestId))
  }
  if (topic === "customers/data_request") {
    return finish(input, await exportCustomer(input, storeId, shopDomain, requestId))
  }
  return finish(input, await redactShop(input, storeId, shopDomain, requestId))
}

function finish(input: ComplianceInput, entry: ComplianceLog): ComplianceLog {
  input.log(entry)
  return entry
}

async function redactCustomer(
  input: ComplianceInput,
  storeId: string,
  shopDomain: string,
  requestId: string
): Promise<ComplianceLog> {
  const customer = readCustomer(input.body)
  const includeEmail = !input.skipSuppressions
  const carts = (await input.db.listCarts(storeId)).filter(
    (cart) => emailsMatch(cart.customerEmail, customer.email) || phonesMatch(cart.customerPhone, customer.phone)
  )
  const token = input.replacementToken ?? (() => `redacted:${randomUUID()}`)
  let messages = 0
  for (const cart of carts) {
    await input.db.anonymizeCart(storeId, cart.id, token())
    messages += await input.db.anonymizeMessages(storeId, cart.id, includeEmail)
  }
  const suppressions = await hashMatchingSuppressions(input, customer.email)
  return { requestId, shopDomain, topic: "customers/redact", carts: carts.length, messages, suppressions }
}

async function exportCustomer(
  input: ComplianceInput,
  storeId: string,
  shopDomain: string,
  requestId: string
): Promise<ComplianceLog> {
  const customer = readCustomer(input.body)
  const includeEmail = !input.skipSuppressions
  const carts = (await input.db.listCarts(storeId)).filter(
    (cart) => emailsMatch(cart.customerEmail, customer.email) || phonesMatch(cart.customerPhone, customer.phone)
  )
  const messages = carts.length
    ? await input.db.listMessagesForCarts(
        storeId,
        carts.map((cart) => cart.id),
        includeEmail
      )
    : []
  const suppressed = await suppressionExists(input, customer.email)
  const body = JSON.stringify(buildExportDocument(carts, messages, suppressed))
  await input.deliverExport({ requestId, shopDomain, body })
  return {
    requestId,
    shopDomain,
    topic: "customers/data_request",
    carts: carts.length,
    messages: messages.length,
    suppressions: suppressed ? 1 : 0,
  }
}

async function redactShop(
  input: ComplianceInput,
  storeId: string,
  shopDomain: string,
  requestId: string
): Promise<ComplianceLog> {
  const suppressions = await convertStoreSuppressions(input, storeId)
  for (const table of SHOP_DELETE_ORDER) {
    await input.db.deleteStoreScoped(table, storeId)
  }
  await input.db.deleteStore(storeId)
  return { requestId, shopDomain, topic: "shop/redact", carts: 0, messages: 0, suppressions }
}

export function buildExportDocument(
  carts: PrivacyCart[],
  messages: PrivacyMessage[],
  suppressed: boolean
) {
  return {
    carts: carts.map((cart) => ({
      id: cart.id,
      status: cart.status,
      customer_email: cart.customerEmail,
      customer_phone: cart.customerPhone,
      customer_name: cart.customerName,
      checkout_url: cart.checkoutUrl,
      created_at: cart.createdAt,
      messages: messages
        .filter((message) => message.cartId === cart.id)
        .map((message) => {
          const row: Record<string, string | null> = {
            id: message.id,
            phone: message.phone,
            email: message.email,
            template_name: message.templateName,
            status: message.status,
            created_at: message.createdAt,
            sent_at: message.sentAt,
          }
          if (message.body) row.body = message.body
          return row
        }),
    })),
    email_suppressed: suppressed,
  }
}

async function hashMatchingSuppressions(input: ComplianceInput, email: string): Promise<number> {
  if (input.skipSuppressions || !email) return 0
  const hashed = suppressionHmac(email, input.hashSecret)
  const keys = hashed ? [email, hashed] : [email]
  let rows: PrivacySuppression[]
  try {
    rows = await input.db.listSuppressionsByEmail(keys)
  } catch (error) {
    if (isMissingSuppressionsTable(error)) return 0
    throw error
  }
  let changed = 0
  for (const row of rows) {
    if (isSuppressionHmac(row.email)) continue
    if (!hashed) throw new PrivacyConfigError("suppression_hash_secret_missing")
    const result = await input.db.updateSuppression(row.id, hashed, row.storeId)
    if (result === "duplicate") await input.db.deleteSuppression(row.id)
    changed += 1
  }
  return changed
}

async function suppressionExists(input: ComplianceInput, email: string): Promise<boolean> {
  if (input.skipSuppressions || !email) return false
  if (!input.hashSecret.trim()) throw new PrivacyConfigError("suppression_hash_secret_missing")
  const hashed = suppressionHmac(email, input.hashSecret)
  const keys = hashed ? [email, hashed] : [email]
  try {
    const rows = await input.db.listSuppressionsByEmail(keys)
    return rows.length > 0
  } catch (error) {
    if (isMissingSuppressionsTable(error)) return false
    throw error
  }
}

async function convertStoreSuppressions(input: ComplianceInput, storeId: string): Promise<number> {
  if (input.skipSuppressions) return 0
  let rows: PrivacySuppression[]
  try {
    rows = await input.db.listSuppressionsForStore(storeId)
  } catch (error) {
    if (isMissingSuppressionsTable(error)) return 0
    throw error
  }
  const secret = input.hashSecret.trim()
  let changed = 0
  for (const row of rows.filter((item) => isSuppressionHmac(item.email))) {
    if (row.storeId === null) continue
    await input.db.updateSuppression(row.id, row.email, null)
    changed += 1
  }
  for (const row of rows.filter((item) => !isSuppressionHmac(item.email))) {
    if (!secret) throw new PrivacyConfigError("suppression_hash_secret_missing")
    const hashed = suppressionHmac(row.email, secret)
    if (!hashed) throw new PrivacyConfigError("suppression_hash_secret_missing")
    const result = await input.db.updateSuppression(row.id, hashed, null)
    if (result === "duplicate") await input.db.deleteSuppression(row.id)
    changed += 1
  }
  return changed
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function readShopDomain(header: string, body: unknown): string {
  const fromHeader = header && header !== "unknown" ? header.trim() : ""
  const fromBody = asRecord(body).shop_domain
  const domain = fromHeader || (typeof fromBody === "string" ? fromBody.trim() : "")
  return domain.toLowerCase()
}

function readCustomer(body: unknown): { email: string; phone: string } {
  const customer = asRecord(asRecord(body).customer)
  return {
    email: typeof customer.email === "string" ? customer.email.trim().toLowerCase() : "",
    phone: typeof customer.phone === "string" ? customer.phone.trim() : "",
  }
}

function readRequestId(body: unknown, fallback: string): string {
  const id = asRecord(asRecord(body).data_request).id
  if (typeof id === "number" && Number.isFinite(id)) return String(id)
  if (typeof id === "string" && /^[\w.-]+$/.test(id)) return id
  return fallback
}

export function complianceErrorCode(error: unknown): string {
  if (error instanceof PrivacyDbError || error instanceof PrivacyConfigError) return error.code
  return "failed"
}
