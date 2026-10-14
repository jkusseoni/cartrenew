import { supabaseAdmin } from '@/lib/supabase'
import { RECOVERY_TEMPLATE_NAME } from '@/lib/services/recovery-dispatch'
import { TEST_MESSAGE_LOG_CART_ID, type TestMessageLog } from '@/lib/shopify/test-message'

const TABLE = 'cart_delivery_metrics'

/** Test-send log in cart_delivery_metrics. Only the masked phone is stored. */
export const supabaseTestMessageLog: TestMessageLog = {
  async reserve({ storeId, shop, maskedPhone }) {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .insert({
        cart_id: TEST_MESSAGE_LOG_CART_ID,
        merchant_id: storeId,
        store_name: shop,
        country: 'unknown',
        primary_channel: 'whatsapp',
        attempted_channel: 'whatsapp',
        status: 'FAILED',
        provider: 'meta',
        error_message: 'in_progress',
        payload: { kind: 'shopify_test_message', phone: maskedPhone, template: RECOVERY_TEMPLATE_NAME },
      })
      .select('id')
      .single()

    if (error || !data) throw new Error(error?.message || 'insert returned no row')
    return (data as { id: string }).id
  },

  async earliestIdsSince(storeId, sinceIso, limit) {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('id')
      .eq('cart_id', TEST_MESSAGE_LOG_CART_ID)
      .eq('merchant_id', storeId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit)

    if (error) throw new Error(error.message)
    return ((data ?? []) as { id: string }[]).map((row) => row.id)
  },

  async release(id) {
    const { error } = await supabaseAdmin.from(TABLE).delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async finish(id, { success, messageId, error: sendError }) {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .update({
        status: success ? 'SUCCESS_WHATSAPP' : 'FAILED',
        provider_message_id: messageId,
        error_message: success ? null : sendError,
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
  },
}
