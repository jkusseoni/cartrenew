import { supabaseAdmin } from '@/lib/supabase'
import { recordCartSendFailure } from '@/lib/services/recovery-dispatch'
import { TEST_MESSAGE_LOG_CART_ID } from '@/lib/shopify/test-message-config'
import { ALLOWED_PRIOR_STATUSES, nextTestDeliveryPayload, type MetaStatusEvent } from '@/lib/whatsapp-status'

export type StatusApplyResult = 'updated' | 'no_change' | 'unknown_message'

/**
 * Apply one Meta status event. Idempotent: the message update only matches
 * rows in a lower status, and cart timestamps are only set while null, so
 * replays and out-of-order events never downgrade anything. Throws on DB
 * errors so the webhook can ask Meta to retry.
 */
export async function applyStatusEvent(event: MetaStatusEvent): Promise<StatusApplyResult> {
  const occurredAt = event.occurredAt ?? new Date().toISOString()

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

  let cartIds = (transitioned ?? []).map((row) => row.cart_id as string)

  if (cartIds.length === 0) {
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('messages')
      .select('cart_id')
      .eq('whatsapp_message_id', event.whatsappMessageId)
    if (lookupError) throw new Error(`message lookup failed: ${lookupError.message}`)
    if (!existing?.length) return applyTestMessageDelivery(event, occurredAt)
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
    await recordCartSendFailure(cartIds, `meta_status_failed: ${event.error ?? 'unknown'}`, {
      final: false,
    })
  }

  return (transitioned?.length ?? 0) > 0 ? 'updated' : 'no_change'
}

/**
 * Pingza dashboard tests log in cart_delivery_metrics (no messages row).
 * Store Meta delivery on the existing payload. Meta sends sent/delivered
 * almost together, so the write only lands if delivery_status is still what
 * we read; otherwise re-read and re-evaluate (never downgrade).
 */
async function applyTestMessageDelivery(
  event: MetaStatusEvent,
  occurredAt: string
): Promise<StatusApplyResult> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: rows, error } = await supabaseAdmin
      .from('cart_delivery_metrics')
      .select('id, payload')
      .eq('cart_id', TEST_MESSAGE_LOG_CART_ID)
      .eq('provider_message_id', event.whatsappMessageId)
      .limit(1)

    if (error) throw new Error(`test-message delivery lookup failed: ${error.message}`)
    const row = rows?.[0] as { id: string; payload: unknown } | undefined
    if (!row?.id) return 'unknown_message'

    const nextPayload = nextTestDeliveryPayload(row.payload, event, occurredAt)
    if (!nextPayload) return 'no_change'

    const previous = (row.payload as Record<string, unknown> | null)?.delivery_status
    let update = supabaseAdmin
      .from('cart_delivery_metrics')
      .update({ payload: nextPayload })
      .eq('id', row.id)
    update =
      typeof previous === 'string'
        ? update.eq('payload->>delivery_status', previous)
        : update.is('payload->>delivery_status', null)

    const { data: updated, error: updateError } = await update.select('id')
    if (updateError) throw new Error(`test-message delivery update failed: ${updateError.message}`)
    if (updated?.length) return 'updated'
    // Lost a race with another status event: re-read and decide again.
  }
  return 'no_change'
}
