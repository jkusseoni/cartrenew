import { supabaseAdmin } from '@/lib/supabase'
import { recordCartSendFailure } from '@/lib/services/recovery-dispatch'
import { decideAfterAttempt } from '@/lib/recovery-retry-policy'
import { ALLOWED_PRIOR_STATUSES, type MetaStatusEvent } from '@/lib/whatsapp-status'

export type StatusApplyResult = 'updated' | 'no_change' | 'unknown_message'

type FailedMessageRow = {
  id: string
  cart_id: string
  attempt_count: number | null
}

type ExistingMessageRow = {
  cart_id: string
  status: string
  error_message: string | null
}

type MessageStatusRow = {
  cart_id: string
  status: string
}

async function lookupMessageStatuses(whatsappMessageId: string): Promise<MessageStatusRow[] | null> {
  const { data: existing, error } = await supabaseAdmin
    .from('messages')
    .select('cart_id, status')
    .eq('whatsapp_message_id', whatsappMessageId)
  if (error) throw new Error(`message lookup failed: ${error.message}`)
  if (!existing?.length) return null
  return existing as MessageStatusRow[]
}

async function updateCartStatus(
  cartIds: string[],
  status: 'pending' | 'lost',
  priorStatuses: Array<'pending' | 'messaged'>
) {
  if (cartIds.length === 0) return
  const { error } = await supabaseAdmin
    .from('abandoned_carts')
    .update({ status })
    .in('id', cartIds)
    .in('status', priorStatuses)
  if (error) throw new Error(`cart ${status} status update failed: ${error.message}`)
}

async function restoreMessagedCartStatus(cartIds: string[]) {
  if (cartIds.length === 0) return
  const { error } = await supabaseAdmin
    .from('abandoned_carts')
    .update({ status: 'messaged' })
    .in('id', cartIds)
    .eq('status', 'pending')
  if (error) throw new Error(`cart status restore failed: ${error.message}`)
}

async function applyFailedStatusEvent(event: MetaStatusEvent): Promise<StatusApplyResult> {
  const reason = `meta_status_failed: ${event.error ?? 'unknown'}`.slice(0, 500)
  const { data: candidates, error: candidateError } = await supabaseAdmin
    .from('messages')
    .select('id, cart_id, attempt_count')
    .eq('whatsapp_message_id', event.whatsappMessageId)
    .eq('status', 'sent')
  if (candidateError) throw new Error(`message lookup failed: ${candidateError.message}`)

  const retryCartIds: string[] = []
  const finalCartIds: string[] = []

  for (const candidate of (candidates ?? []) as FailedMessageRow[]) {
    const decision = decideAfterAttempt(false, reason, candidate.attempt_count ?? 0)
    const messageUpdate =
      decision.kind === 'retry'
        ? {
            status: 'pending',
            error_message: reason,
            next_retry_at: decision.nextRetryAt,
          }
        : {
            status: 'failed',
            error_message: reason,
            next_retry_at: null,
          }

    const { data: transitioned, error } = await supabaseAdmin
      .from('messages')
      .update(messageUpdate)
      .eq('id', candidate.id)
      .eq('whatsapp_message_id', event.whatsappMessageId)
      .eq('status', 'sent')
      .select('cart_id')
    if (error) throw new Error(`message status update failed: ${error.message}`)

    if (transitioned?.length) {
      const target = decision.kind === 'retry' ? retryCartIds : finalCartIds
      target.push(...transitioned.map((row) => row.cart_id as string))
    }
  }

  const transitionedCount = retryCartIds.length + finalCartIds.length
  if (transitionedCount === 0) {
    const { data: existing, error } = await supabaseAdmin
      .from('messages')
      .select('cart_id, status, error_message')
      .eq('whatsapp_message_id', event.whatsappMessageId)
    if (error) throw new Error(`message lookup failed: ${error.message}`)
    if (!existing?.length) return 'unknown_message'

    const rows = existing as ExistingMessageRow[]
    await updateCartStatus(
      rows
        .filter((row) => row.status === 'pending' && row.error_message === reason)
        .map((row) => row.cart_id),
      'pending',
      ['messaged']
    )
    await updateCartStatus(
      rows
        .filter((row) => row.status === 'failed' && row.error_message === reason)
        .map((row) => row.cart_id),
      'lost',
      ['pending', 'messaged']
    )
    return 'no_change'
  }

  if (retryCartIds.length) {
    await updateCartStatus(retryCartIds, 'pending', ['messaged'])
    await recordCartSendFailure(retryCartIds, reason, { final: false })
  }

  if (finalCartIds.length) {
    await updateCartStatus(finalCartIds, 'lost', ['pending', 'messaged'])
    await recordCartSendFailure(finalCartIds, reason, { final: false })
  }

  return 'updated'
}

/**
 * Apply one Meta status event. Idempotent: the message update only matches
 * rows in a lower status, and cart timestamps are only set while null, so
 * replays and out-of-order events never downgrade anything. Throws on DB
 * errors so the webhook can ask Meta to retry.
 */
export async function applyStatusEvent(event: MetaStatusEvent): Promise<StatusApplyResult> {
  const occurredAt = event.occurredAt ?? new Date().toISOString()

  if (event.status === 'failed') {
    return applyFailedStatusEvent(event)
  }

  const update: Record<string, unknown> = { status: event.status }

  const { data: transitioned, error } = await supabaseAdmin
    .from('messages')
    .update(update)
    .eq('whatsapp_message_id', event.whatsappMessageId)
    .in('status', ALLOWED_PRIOR_STATUSES[event.status])
    .select('cart_id')

  if (error) throw new Error(`message status update failed: ${error.message}`)

  let cartIds = (transitioned ?? []).map((row) => row.cart_id as string)

  if (cartIds.length === 0) {
    const existing = await lookupMessageStatuses(event.whatsappMessageId)
    if (!existing) return 'unknown_message'
    // Already at an equal/higher status. delivered/read still backfill cart
    // timestamps in case an earlier delivery of this event failed midway.
    cartIds = existing
      .filter((row) => event.status !== 'sent' || row.status === 'sent')
      .map((row) => row.cart_id)
  }

  if (event.status === 'sent' || event.status === 'delivered' || event.status === 'read') {
    await restoreMessagedCartStatus(cartIds)
  }

  if (event.status === 'delivered' || event.status === 'read') {
    const { error: deliveredError } = await supabaseAdmin
      .from('abandoned_carts')
      .update({ message_delivered_at: occurredAt })
      .in('id', cartIds)
      .is('message_delivered_at', null)
    if (deliveredError) throw new Error(`cart delivered_at update failed: ${deliveredError.message}`)
  }

  if (event.status === 'read') {
    const { error: readError } = await supabaseAdmin
      .from('abandoned_carts')
      .update({ message_read_at: occurredAt })
      .in('id', cartIds)
      .is('message_read_at', null)
    if (readError) throw new Error(`cart read_at update failed: ${readError.message}`)
  }

  return (transitioned?.length ?? 0) > 0 ? 'updated' : 'no_change'
}
