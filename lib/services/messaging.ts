import { supabaseAdmin } from '@/lib/supabase'

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

export function compileRecoveryMessage(template: string, context: RecoveryMessageContext) {
  return template.replace(/{{\s*([^}\s]+)\s*}}/g, (_match, key: string) => {
    const normalizedKey = key.trim()
    return String((context as any)[normalizedKey] ?? '')
  })
}

export function getDefaultRecoveryTemplate() {
  return `Hi {{customer_name}}! 👋\n\nYou left something in your cart:\n\n{{item_list}}\n\nTotal: {{cart_value}}\n\nComplete your order: {{checkout_url}}\n\nNeed help? Just reply to this message.`
}

export async function queueRecoveryMessageForCart({
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
  items?: any[]
  customerEmail?: string | null
  cartToken?: string | null
}) {
  if (!customerPhone) {
    console.warn(`Queue recovery message skipped: missing phone for cart ${cartId}`)
    return false
  }

  try {
    const { data: template } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const templateBody = template?.body || getDefaultRecoveryTemplate()
    const templateName = template?.name || 'default'
    const itemList = Array.isArray(items)
      ? items.map((item: any) => `• ${item.title || 'item'} (x${item.quantity || 1})`).join('\n')
      : ''

    const messageBody = compileRecoveryMessage(templateBody, {
      customer_name: customerName || 'there',
      customer_first_name: customerName?.split(' ')[0] || '',
      customer_last_name: customerName?.split(' ').slice(1).join(' ') || '',
      checkout_url: checkoutUrl || '',
      cart_value: cartValue != null ? `₹${cartValue}` : '',
      item_list: itemList,
      customer_email: customerEmail || '',
      customer_phone: customerPhone,
      cart_token: cartToken || '',
    })

    await supabaseAdmin.from('messages').insert({
      cart_id: cartId,
      store_id: storeId,
      phone: customerPhone,
      template_name: templateName,
      body: messageBody,
      status: 'pending' as any,
      attempt_count: 0,
      next_retry_at: null,
    })

    return true
  } catch (error) {
    console.error('Failed to queue recovery message:', error)
    return false
  }
}
