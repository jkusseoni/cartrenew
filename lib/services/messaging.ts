import { supabaseAdmin } from '@/lib/supabase'
import {
  hasWhatsAppCredentials,
  resolveRecoveryCustomerName,
  sendWhatsAppMessage,
} from '@/lib/services/whatsapp-meta'
import { sendMessage } from '@/lib/services/provider'
import { getTrackedRecoveryUrl } from '@/lib/recovery-link'

export type RecoveryMessageContext = {
  customer_name: string
  customer_first_name?: string
  customer_last_name?: string
  checkout_url: string
  cart_value: string
  item_list: string
  customer_email?: string
  customer_phone?: string
  cart_token?: string
}

export type WhatsAppRecoveryResult = {
  queued: boolean
  sent: boolean
  mocked?: boolean
  messageId?: string | null
  error?: string | null
}

export function compileRecoveryMessage(template: string, context: RecoveryMessageContext) {
  return template.replace(/{{\s*([^}\s]+)\s*}}/g, (_match, key: string) => {
    const normalizedKey = key.trim()
    return String((context as Record<string, string | undefined>)[normalizedKey] ?? '')
  })
}

export function getDefaultRecoveryTemplate() {
  return `Hi {{customer_name}}! 👋\n\nYou left something in your cart:\n\n{{item_list}}\n\nTotal: {{cart_value}}\n\nComplete your order: {{checkout_url}}\n\nNeed help? Just reply to this message.`
}

function buildRecoveryMessageBody({
  storeId,
  customerName,
  checkoutUrl,
  cartValue,
  items,
  customerEmail,
  customerPhone,
  cartToken,
}: {
  storeId: string
  customerName?: string | null
  checkoutUrl?: string | null
  cartValue?: number
  items?: unknown[]
  customerEmail?: string | null
  customerPhone?: string | null
  cartToken?: string | null
}) {
  // Only body/name are used below — avoid pulling the whole template row.
  return supabaseAdmin
    .from('message_templates')
    .select('body, name')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
    .then(({ data: template }) => {
      const templateBody = template?.body || getDefaultRecoveryTemplate()
      const templateName = template?.name || 'cart_recovery_default'
      
      // ✅ LOGIC BUG FIXED: Unknown parameter mapping perfectly bypassed with safe fallback
      const safeItems = Array.isArray(items) ? items : []
      const itemList = safeItems
        .map((item: any) =>
          `• ${item?.title || 'item'} (x${item?.quantity || 1})`
        )
        .join('\n')

      const messageBody = compileRecoveryMessage(templateBody, {
        customer_name: customerName || 'there',
        customer_first_name: customerName?.split(' ')[0] || '',
        customer_last_name: customerName?.split(' ').slice(1).join(' ') || '',
        checkout_url: checkoutUrl || '',
        cart_value: cartValue != null ? `₹${cartValue}` : '',
        item_list: itemList,
        customer_email: customerEmail || '',
        customer_phone: customerPhone || '',
        cart_token: cartToken || '',
      })

      return { messageBody, templateName }
    })
}

/**
 * After a pending abandoned cart is saved, compile the per-store free-text for
 * record-keeping, persist a messages row, and dispatch via Meta WhatsApp
 * (approved template — business-initiated, no active customer session).
 * Richer template (cart_recovery_default: discount/expiry/store name + URL
 * button) will replace abandoned_cart_reminder once approved.
 */
export async function triggerWhatsAppRecoveryForCart({
  storeId,
  cartId,
  customerPhone,
  customerName,
  checkoutUrl,
  cartValue,
  items,
  customerEmail,
  cartToken,
}: {
  storeId: string
  cartId: string
  customerPhone?: string | null
  customerName?: string | null
  checkoutUrl?: string | null
  cartValue?: number
  items?: unknown[]
  customerEmail?: string | null
  cartToken?: string | null
}): Promise<WhatsAppRecoveryResult> {
  if (!customerPhone) {
    console.warn(`WhatsApp recovery skipped: missing phone for cart ${cartId}`)
    return { queued: false, sent: false, error: 'missing_phone' }
  }

  try {
    const { messageBody, templateName } = await buildRecoveryMessageBody({
      storeId,
      customerName: resolveRecoveryCustomerName(customerName),
      checkoutUrl: getTrackedRecoveryUrl(cartId),
      cartValue,
      items,
      customerEmail,
      customerPhone,
      cartToken,
    })

    const trackedCheckoutUrl = getTrackedRecoveryUrl(cartId)
    const safeName = resolveRecoveryCustomerName(customerName)
    // Per-merchant free-text kept for reference only — WhatsApp requires pre-approved templates for business-initiated sends. Will move to variable-based customization (discount/expiry/store name) once the richer template is approved.
    const whatsappTemplateName = 'abandoned_cart_reminder'

    const { data: messageRow, error: insertError } = await supabaseAdmin
      .from('messages')
      .insert({
        cart_id: cartId,
        store_id: storeId,
        phone: customerPhone,
        template_name: whatsappTemplateName,
        body: messageBody,
        status: 'queued',
        attempt_count: 0,
        next_retry_at: null,
      })
      .select('id')
      .single()

    if (insertError || !messageRow?.id) {
      console.error('Failed to insert recovery message row:', insertError)
      return { queued: false, sent: false, error: insertError?.message || 'insert_failed' }
    }

    console.log('📤 triggerWhatsAppRecoveryForCart Meta template payload', {
      cartId,
      to: customerPhone,
      templateName: whatsappTemplateName,
      bodyVariables: [safeName, trackedCheckoutUrl],
    })

    const dispatch = hasWhatsAppCredentials()
      ? await sendWhatsAppMessage(customerPhone, {
          templateName: whatsappTemplateName,
          languageCode: 'en',
          bodyVariables: [safeName, trackedCheckoutUrl],
        }).then((result) => ({
          success: result.success,
          providerId: result.messageId,
          error: result.error,
          provider: 'meta_whatsapp' as const,
        }))
      : await sendMessage({
          id: messageRow.id,
          to: customerPhone,
          body: messageBody,
          templateName,
        })

    if (dispatch.success) {
      await supabaseAdmin
        .from('messages')
        .update({
          status: 'sent',
          whatsapp_message_id: dispatch.providerId || null,
          sent_at: new Date().toISOString(),
          attempt_count: 1,
          error_message: null,
        })
        .eq('id', messageRow.id)

      await supabaseAdmin
        .from('abandoned_carts')
        .update({
          status: 'messaged',
          message_sent_at: new Date().toISOString(),
        })
        .eq('id', cartId)
        .eq('status', 'pending')

      console.log(
        `✅ WhatsApp recovery sent for cart ${cartId} via ${dispatch.provider ?? 'provider'}`
      )

      return { queued: true, sent: true, messageId: dispatch.providerId }
    }

    await supabaseAdmin
      .from('messages')
      .update({
        status: 'pending',
        error_message: dispatch.error || 'send_failed',
        attempt_count: 1,
        next_retry_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      })
      .eq('id', messageRow.id)

    console.warn(`WhatsApp recovery dispatch failed for cart ${cartId}:`, dispatch.error)

    return { queued: true, sent: false, error: dispatch.error }
  } catch (error) {
    console.error('Failed to trigger WhatsApp recovery:', error)
    return {
      queued: false,
      sent: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** @deprecated Use triggerWhatsAppRecoveryForCart — kept for backward compatibility. */
export async function queueRecoveryMessageForCart(
  params: Parameters<typeof triggerWhatsAppRecoveryForCart>[0]
) {
  const result = await triggerWhatsAppRecoveryForCart(params)
  return result.queued
}
