/**
 * Shared WhatsApp recovery send bookkeeping.
 *
 * Invariants:
 * - abandoned_carts.status becomes 'messaged' (with message_sent_at) only after
 *   the Graph API accepted the message.
 * - Every Graph attempt has a `messages` row, so Meta status webhooks can map
 *   whatsapp_message_id back to the cart.
 * - A rejected attempt is recorded on the cart (last_send_error /
 *   last_send_failed_at); after the final attempt the cart becomes 'lost'.
 * - Retries are capped at MAX_SEND_ATTEMPTS and never sent for reminders older
 *   than RECOVERY_SEND_MAX_AGE_MS.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { maskPhone } from '@/lib/phone'
import { getTrackedRecoveryUrl } from '@/lib/recovery-link'
import {
  decideAfterAttempt,
  MAX_SEND_ATTEMPTS,
  RECOVERY_SEND_MAX_AGE_MS,
  type SendOutcomeDecision,
} from '@/lib/recovery-retry-policy'
import {
  buildAbandonedCartTemplateVariables,
  resolveWhatsAppRecipient,
  sendWhatsAppMessage,
  type WhatsAppSendResult,
} from '@/lib/services/whatsapp-meta'

export const RECOVERY_TEMPLATE_NAME = 'abandoned_cart_reminder'

/** A first-attempt claim older than this is considered abandoned (crashed run). */
const CART_CLAIM_STALE_MS = 15 * 60 * 1000

/** Max ids per `.in()` filter, keeps PostgREST URLs short. */
const IN_FILTER_CHUNK = 100

function nowIso() {
  return new Date().toISOString()
}

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size))
  return out
}

export function sendRecoveryTemplate({
  phone,
  customerName,
  checkoutUrl,
}: {
  phone: string
  customerName?: string | null
  checkoutUrl: string
}): Promise<WhatsAppSendResult> {
  return sendWhatsAppMessage(phone, {
    templateName: RECOVERY_TEMPLATE_NAME,
    languageCode: 'en',
    bodyVariables: buildAbandonedCartTemplateVariables({ customerName, checkoutUrl }),
  })
}

export async function markCartMessaged(cartId: string, sentAt: string) {
  const { error } = await supabaseAdmin
    .from('abandoned_carts')
    .update({ status: 'messaged', message_sent_at: sentAt })
    .eq('id', cartId)
    .eq('status', 'pending')

  if (error) console.error(`Failed to mark cart ${cartId} messaged:`, error.message)
}

/**
 * Record a rejected/unsendable attempt on carts. `final` moves still-pending
 * carts to 'lost'. The failure columns are written separately so a missing
 * migration can't block the status change.
 */
export async function recordCartSendFailure(
  cartIds: string | string[],
  reason: string,
  { final }: { final: boolean }
) {
  const ids = Array.from(new Set(Array.isArray(cartIds) ? cartIds : [cartIds])).filter(Boolean)
  const failedAt = nowIso()

  for (const batch of chunk(ids, IN_FILTER_CHUNK)) {
    if (final) {
      const { error } = await supabaseAdmin
        .from('abandoned_carts')
        .update({ status: 'lost' })
        .in('id', batch)
        .eq('status', 'pending')
      if (error) console.error('Failed to mark carts lost after send failure:', error.message)
    }

    const { error } = await supabaseAdmin
      .from('abandoned_carts')
      .update({ last_send_error: reason.slice(0, 500), last_send_failed_at: failedAt })
      .in('id', batch)
    if (error) {
      console.error(
        'Failed to record send failure on carts (is db/migrations/2026-10-02-whatsapp-send-failures.sql applied?):',
        error.message
      )
    }
  }
}

/** Persist one attempt's outcome on the messages row and the cart. */
export async function recordAttemptOutcome({
  messageId,
  cartId,
  attemptsMade,
  accepted,
  whatsappMessageId,
  error,
}: {
  messageId: string
  cartId: string
  attemptsMade: number
  accepted: boolean
  whatsappMessageId?: string | null
  error?: string | null
}): Promise<SendOutcomeDecision> {
  const decision = decideAfterAttempt(accepted, error, attemptsMade)
  const at = nowIso()

  const messageUpdate =
    decision.kind === 'sent'
      ? {
          status: 'sent',
          whatsapp_message_id: whatsappMessageId || null,
          sent_at: at,
          attempt_count: attemptsMade,
          error_message: null,
          next_retry_at: null,
        }
      : decision.kind === 'retry'
        ? {
            status: 'pending',
            error_message: error || 'send_failed',
            attempt_count: attemptsMade,
            next_retry_at: decision.nextRetryAt,
          }
        : {
            status: 'failed',
            error_message: decision.reason,
            attempt_count: attemptsMade,
            next_retry_at: null,
          }

  const { error: messageError } = await supabaseAdmin
    .from('messages')
    .update(messageUpdate)
    .eq('id', messageId)
    .in('status', ['queued', 'pending'])
  if (messageError) {
    console.error(`Failed to record attempt outcome on message ${messageId}:`, messageError.message)
  }

  if (decision.kind === 'sent') {
    if (!whatsappMessageId) {
      console.warn(`Graph accepted message for cart ${cartId} without a message id — delivery status can't be tracked`)
    }
    await markCartMessaged(cartId, at)
  } else {
    await recordCartSendFailure(cartId, error || 'send_failed', { final: decision.kind === 'failed' })
  }

  return decision
}

type CartRow = {
  id: string
  store_id: string
  customer_phone: string | null
  customer_name: string | null
  checkout_url: string | null
}

export type RecoveryRunResult = {
  id: string
  cartId: string
  outcome: 'sent' | 'retry_scheduled' | 'failed' | 'skipped'
  reason?: string | null
}

function outcomeFromDecision(decision: SendOutcomeDecision): RecoveryRunResult['outcome'] {
  return decision.kind === 'sent' ? 'sent' : decision.kind === 'retry' ? 'retry_scheduled' : 'failed'
}

async function claimCartForFirstAttempt(cartId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - CART_CLAIM_STALE_MS).toISOString()
  const { data, error } = await supabaseAdmin
    .from('abandoned_carts')
    .update({ processing_started_at: nowIso() })
    .eq('id', cartId)
    .eq('status', 'pending')
    .or(`processing_started_at.is.null,processing_started_at.lt.${staleBefore}`)
    .select('id')

  if (error) throw new Error(`claim failed for cart ${cartId}: ${error.message}`)
  return (data?.length ?? 0) > 0
}

async function cartHasMessageRow(cartId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('id')
    .eq('cart_id', cartId)
    .limit(1)
  if (error) throw new Error(`message lookup failed for cart ${cartId}: ${error.message}`)
  return (data?.length ?? 0) > 0
}

/**
 * First send for recent pending carts that have never been attempted (no
 * messages row). Carts with an existing row are owned by the retry pass.
 */
export async function processFirstAttempts({ limit = 25 } = {}): Promise<RecoveryRunResult[]> {
  const since = new Date(Date.now() - RECOVERY_SEND_MAX_AGE_MS).toISOString()
  const { data: carts, error } = await supabaseAdmin
    .from('abandoned_carts')
    .select('id, store_id, customer_phone, customer_name, checkout_url')
    .eq('status', 'pending')
    .not('customer_phone', 'is', null)
    .neq('customer_phone', '')
    .gte('created_at', since)
    .order('updated_at', { ascending: true })
    .limit(limit * 4)

  if (error) throw new Error(`pending cart query failed: ${error.message}`)

  const pending = (carts ?? []) as CartRow[]
  if (pending.length === 0) return []

  const attempted = new Set<string>()
  for (const batch of chunk(pending.map((cart) => cart.id), IN_FILTER_CHUNK)) {
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('messages')
      .select('cart_id')
      .in('cart_id', batch)
    if (rowsError) throw new Error(`message lookup failed: ${rowsError.message}`)
    for (const row of rows ?? []) attempted.add(row.cart_id as string)
  }

  const results: RecoveryRunResult[] = []

  const eligible = pending.filter(
    (row) => row.customer_phone?.trim() && !attempted.has(row.id)
  )

  for (const cart of eligible.slice(0, limit)) {
    try {
      if (!cart.customer_phone?.trim()) {
        results.push({ id: cart.id, cartId: cart.id, outcome: 'skipped', reason: 'missing_phone' })
        continue
      }

      if (!(await claimCartForFirstAttempt(cart.id))) {
        results.push({ id: cart.id, cartId: cart.id, outcome: 'skipped', reason: 'already_claimed' })
        continue
      }

      // The Shopify webhook may have dispatched between our query and claim.
      if (await cartHasMessageRow(cart.id)) {
        results.push({ id: cart.id, cartId: cart.id, outcome: 'skipped', reason: 'already_attempted' })
        continue
      }

      const recipient = resolveWhatsAppRecipient(cart.customer_phone)
      if (!recipient.ok) {
        console.warn('WhatsApp recovery not sent — phone not sendable', {
          cartId: cart.id,
          reason: recipient.error,
          phone: maskPhone(cart.customer_phone),
        })
        await recordCartSendFailure(cart.id, recipient.error, { final: true })
        results.push({ id: cart.id, cartId: cart.id, outcome: 'failed', reason: recipient.error })
        continue
      }

      const phone = `+${recipient.to}`
      const { data: messageRow, error: insertError } = await supabaseAdmin
        .from('messages')
        .insert({
          cart_id: cart.id,
          store_id: cart.store_id,
          phone,
          template_name: RECOVERY_TEMPLATE_NAME,
          status: 'queued',
          attempt_count: 0,
          next_retry_at: null,
        })
        .select('id')
        .single()

      if (insertError || !messageRow?.id) {
        console.error(`Failed to insert message row for cart ${cart.id}:`, insertError?.message)
        results.push({ id: cart.id, cartId: cart.id, outcome: 'skipped', reason: 'message_insert_failed' })
        continue
      }

      const send = await sendRecoveryTemplate({
        phone,
        customerName: cart.customer_name,
        checkoutUrl: cart.checkout_url || getTrackedRecoveryUrl(cart.id),
      })

      const decision = await recordAttemptOutcome({
        messageId: messageRow.id,
        cartId: cart.id,
        attemptsMade: 1,
        accepted: send.success,
        whatsappMessageId: send.messageId,
        error: send.error,
      })

      results.push({
        id: messageRow.id,
        cartId: cart.id,
        outcome: outcomeFromDecision(decision),
        reason: send.success ? null : send.error,
      })
    } catch (err) {
      console.error(`First-attempt recovery failed for cart ${cart.id}:`, err)
      results.push({
        id: cart.id,
        cartId: cart.id,
        outcome: 'skipped',
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return results
}

type PendingMessageRow = {
  id: string
  cart_id: string
  phone: string
  attempt_count: number | null
}

async function failMessage(messageId: string, reason: string, fromStatus: 'pending' | 'queued') {
  const { error } = await supabaseAdmin
    .from('messages')
    .update({ status: 'failed', error_message: reason, next_retry_at: null })
    .eq('id', messageId)
    .eq('status', fromStatus)
  if (error) console.error(`Failed to mark message ${messageId} failed:`, error.message)
}

/**
 * Retry pending messages whose next_retry_at has passed (capped at
 * MAX_SEND_ATTEMPTS). Pending messages older than the send window are
 * marked failed without sending.
 */
export async function processDueRetries({ limit = 25 } = {}): Promise<{
  expired: number
  results: RecoveryRunResult[]
}> {
  const cutoff = new Date(Date.now() - RECOVERY_SEND_MAX_AGE_MS).toISOString()
  const { data: expiredRows, error: expireError } = await supabaseAdmin
    .from('messages')
    .update({ status: 'failed', error_message: 'expired_before_retry', next_retry_at: null })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id, cart_id')

  if (expireError) throw new Error(`expiring stale messages failed: ${expireError.message}`)

  const expiredCartIds = (expiredRows ?? []).map((row) => row.cart_id as string)
  if (expiredCartIds.length) {
    await recordCartSendFailure(expiredCartIds, 'expired_before_retry', { final: true })
  }

  const { data: dueRows, error: dueError } = await supabaseAdmin
    .from('messages')
    .select('id, cart_id, phone, attempt_count')
    .eq('status', 'pending')
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso()}`)
    .order('next_retry_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (dueError) throw new Error(`due retry query failed: ${dueError.message}`)

  const results: RecoveryRunResult[] = []

  for (const message of (dueRows ?? []) as PendingMessageRow[]) {
    let claimedForSend = false
    try {
      const attemptsSoFar = message.attempt_count ?? 0

      if (attemptsSoFar >= MAX_SEND_ATTEMPTS) {
        await failMessage(message.id, 'max_attempts_reached', 'pending')
        await recordCartSendFailure(message.cart_id, 'max_attempts_reached', { final: true })
        results.push({ id: message.id, cartId: message.cart_id, outcome: 'failed', reason: 'max_attempts_reached' })
        continue
      }

      const { data: claimed, error: claimError } = await supabaseAdmin
        .from('messages')
        .update({ status: 'queued' })
        .eq('id', message.id)
        .eq('status', 'pending')
        .select('id')
      if (claimError) throw new Error(claimError.message)
      if (!claimed?.length) {
        results.push({ id: message.id, cartId: message.cart_id, outcome: 'skipped', reason: 'already_claimed' })
        continue
      }
      claimedForSend = true

      const { data: cart, error: cartError } = await supabaseAdmin
        .from('abandoned_carts')
        .select('id, status, customer_name, checkout_url')
        .eq('id', message.cart_id)
        .maybeSingle()
      if (cartError) throw new Error(cartError.message)

      if (!cart || cart.status !== 'pending') {
        const reason = `cart_${cart?.status ?? 'missing'}`
        await failMessage(message.id, reason, 'queued')
        results.push({ id: message.id, cartId: message.cart_id, outcome: 'skipped', reason })
        continue
      }

      const send = await sendRecoveryTemplate({
        phone: message.phone,
        customerName: cart.customer_name,
        checkoutUrl: cart.checkout_url || getTrackedRecoveryUrl(cart.id),
      })
      claimedForSend = false

      const decision = await recordAttemptOutcome({
        messageId: message.id,
        cartId: cart.id,
        attemptsMade: attemptsSoFar + 1,
        accepted: send.success,
        whatsappMessageId: send.messageId,
        error: send.error,
      })

      results.push({
        id: message.id,
        cartId: cart.id,
        outcome: outcomeFromDecision(decision),
        reason: send.success ? null : send.error,
      })
    } catch (err) {
      console.error(`Retry failed for message ${message.id}:`, err)
      if (claimedForSend) {
        // Nothing was sent yet — hand the row back to the next run.
        await supabaseAdmin
          .from('messages')
          .update({ status: 'pending' })
          .eq('id', message.id)
          .eq('status', 'queued')
      }
      results.push({
        id: message.id,
        cartId: message.cart_id,
        outcome: 'skipped',
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { expired: expiredCartIds.length, results }
}
