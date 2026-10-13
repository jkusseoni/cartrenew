const DAY_MS = 24 * 60 * 60 * 1000

export const RETENTION_URL_MS = 7 * DAY_MS
export const RETENTION_TERMINAL_MS = 30 * DAY_MS
export const RETENTION_ANY_MS = 90 * DAY_MS

/** Columns the cron may read. `updated_at` is intentionally absent. */
export const RETENTION_CART_COLUMNS =
  "id, store_id, status, created_at, message_sent_at, recovery_completed_at, last_send_failed_at, customer_phone, customer_email, customer_name, checkout_url, last_send_error, items"

const TERMINAL = new Set(["messaged", "recovered", "lost", "skipped"])

export type RetentionCart = {
  id: string
  storeId: string
  status: string | null
  createdAt: string | null
  messageSentAt: string | null
  recoveryCompletedAt: string | null
  lastSendFailedAt: string | null
  customerPhone: string | null
  customerEmail: string | null
  customerName: string | null
  checkoutUrl: string | null
  lastSendError: string | null
  items: unknown
}

export type RetentionAction = "anonymize" | "clear-url" | "none"

export function isRetentionDryRun(raw: string | undefined): boolean {
  return raw !== "false"
}

export function retentionBatchSize(raw: string | undefined): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) return 100
  return Math.floor(parsed)
}

export function retentionPlan(cart: RetentionCart, now: number): RetentionAction {
  const created = timeOf(cart.createdAt)
  const anonymizeDue =
    (created !== null && now - created >= RETENTION_ANY_MS) ||
    (TERMINAL.has(cart.status ?? "") && terminalDue(cart, now))
  if (anonymizeDue && hasPersonalData(cart)) return "anonymize"
  if (created !== null && now - created >= RETENTION_URL_MS && cart.checkoutUrl) return "clear-url"
  return "none"
}

export function stripItemImages(items: unknown): unknown {
  if (!Array.isArray(items)) return []
  return items.map((item) => {
    if (!item || typeof item !== "object") return item
    const copy = { ...(item as Record<string, unknown>) }
    delete copy.image
    return copy
  })
}

export function anonymizedRetentionCart(items: unknown) {
  return {
    customer_phone: null,
    customer_email: null,
    customer_name: null,
    checkout_url: null,
    last_send_error: null,
    items: stripItemImages(items),
  }
}

export function retentionMessagePatch(includeEmail: boolean) {
  return {
    phone: null,
    error_message: null,
    ...(includeEmail ? { email: null } : {}),
  }
}

export type RetentionCounts = {
  dryRun: boolean
  inspected: number
  anonymized: number
  urlsCleared: number
}

export async function applyRetention(input: {
  carts: RetentionCart[]
  now: number
  dryRun: boolean
  writeCart: (cart: RetentionCart, action: Exclude<RetentionAction, "none">) => Promise<void>
  writeMessages: (cart: RetentionCart) => Promise<void>
}): Promise<RetentionCounts> {
  let anonymized = 0
  let urlsCleared = 0
  for (const cart of input.carts) {
    const action = retentionPlan(cart, input.now)
    if (action === "none") continue
    if (!input.dryRun) {
      await input.writeCart(cart, action)
      if (action === "anonymize") await input.writeMessages(cart)
    }
    if (action === "anonymize") anonymized += 1
    else urlsCleared += 1
  }
  return {
    dryRun: input.dryRun,
    inspected: input.carts.length,
    anonymized,
    urlsCleared,
  }
}

function terminalDue(cart: RetentionCart, now: number): boolean {
  const stamp =
    cart.status === "messaged"
      ? timeOf(cart.messageSentAt) ?? timeOf(cart.createdAt)
      : cart.status === "recovered"
        ? timeOf(cart.recoveryCompletedAt) ?? timeOf(cart.createdAt)
        : timeOf(cart.lastSendFailedAt) ?? timeOf(cart.createdAt)
  return stamp !== null && now - stamp >= RETENTION_TERMINAL_MS
}

function hasPersonalData(cart: RetentionCart): boolean {
  if (cart.customerPhone || cart.customerEmail || cart.customerName || cart.checkoutUrl || cart.lastSendError) {
    return true
  }
  return Array.isArray(cart.items) && cart.items.some((item) => {
    return Boolean(item) && typeof item === "object" && "image" in item
  })
}

function timeOf(value: string | null): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}
