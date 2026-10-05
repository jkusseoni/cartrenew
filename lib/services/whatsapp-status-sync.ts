import { appendFileSync } from 'node:fs'
import { supabaseAdmin } from '@/lib/supabase'
import { recordCartSendFailure } from '@/lib/services/recovery-dispatch'
import { ALLOWED_PRIOR_STATUSES, type MetaStatusEvent } from '@/lib/whatsapp-status'

export type StatusApplyResult = 'updated' | 'no_change' | 'unknown_message'

/**
 * Apply one Meta status event. Idempotent: the message update only matches
 * rows in a lower status, and cart timestamps are only set while null, so
 * replays and out-of-order events never downgrade anything. Throws on DB
 * errors so the webhook can ask Meta to retry.
 */
export async function applyStatusEvent(event: MetaStatusEvent): Promise<StatusApplyResult> {
  const occurredAt = event.occurredAt ?? new Date().toISOString()

  // #region agent log
  appendFileSync('/opt/cursor/logs/debug.log', JSON.stringify({ hypothesisId: 'A/E', location: 'lib/services/whatsapp-status-sync.ts:18', message: 'applyStatusEvent entry', data: { eventStatus: event.status, allowedPriorStatuses: ALLOWED_PRIOR_STATUSES[event.status] }, timestamp: Date.now() }) + '\n')
  // #endregion

  const update: Record<string, unknown> = { status: event.status }
  if (event.status === 'failed') {
    update.error_message = `meta_status_failed: ${event.error ?? 'unknown'}`.slice(0, 500)
  }

  const { data: transitioned, error } = await supabaseAdmin
    .from('messages')
    .update(update)
    .eq('whatsapp_message_id', event.whatsappMessageId)
    .in('status', ALLOWED_PRIOR_STATUSES[event.status])
    .select('cart_id')

  if (error) throw new Error(`message status update failed: ${error.message}`)

  // #region agent log
  appendFileSync('/opt/cursor/logs/debug.log', JSON.stringify({ hypothesisId: 'A/E', location: 'lib/services/whatsapp-status-sync.ts:36', message: 'message status transition result', data: { eventStatus: event.status, transitionedCount: transitioned?.length ?? 0 }, timestamp: Date.now() }) + '\n')
  // #endregion

  let cartIds = (transitioned ?? []).map((row) => row.cart_id as string)

  if (cartIds.length === 0) {
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('messages')
      .select('cart_id')
      .eq('whatsapp_message_id', event.whatsappMessageId)
    if (lookupError) throw new Error(`message lookup failed: ${lookupError.message}`)
    if (!existing?.length) return 'unknown_message'
    // Already at an equal/higher status. delivered/read still backfill cart
    // timestamps in case an earlier delivery of this event failed midway.
    if (event.status !== 'delivered' && event.status !== 'read') return 'no_change'
    cartIds = existing.map((row) => row.cart_id as string)
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

  if (event.status === 'failed') {
    // Accepted by Graph but undeliverable: keep the cart status, record why.
    // #region agent log
    appendFileSync('/opt/cursor/logs/debug.log', JSON.stringify({ hypothesisId: 'B', location: 'lib/services/whatsapp-status-sync.ts:75', message: 'recording Meta failure without final cart transition', data: { cartCount: cartIds.length, final: false }, timestamp: Date.now() }) + '\n')
    // #endregion
    await recordCartSendFailure(cartIds, `meta_status_failed: ${event.error ?? 'unknown'}`, {
      final: false,
    })
  }

  return (transitioned?.length ?? 0) > 0 ? 'updated' : 'no_change'
}
