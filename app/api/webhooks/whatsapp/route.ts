import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

// ============================================
// POST /api/whatsapp/send
// Send WhatsApp message to a customer
// ============================================
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { cartId } = await req.json()
    
    // Get cart with store details
    const { data: cart, error: cartError } = await supabaseAdmin
      .from('abandoned_carts')
      .select(`
        *,
        store:stores(*)
      `)
      .eq('id', cartId)
      .single()
    
    if (cartError || !cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
    }
    
    // Verify ownership
    if (cart.store.clerk_user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    if (!cart.customer_phone) {
      return NextResponse.json({ error: 'No phone number' }, { status: 400 })
    }
    
    // Get active template
    const { data: template } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .eq('store_id', cart.store_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    
    // Build message body
    let messageBody = template?.body || getDefaultTemplate()
    const customerName = cart.customer_name || 'there'
    const items = Array.isArray(cart.items) ? cart.items : []
    const itemList = items.map((i: any) => `• ${i.title} (x${i.quantity})`).join('\n')
    
    messageBody = messageBody
      .replace(/{{customer_name}}/g, customerName)
      .replace(/{{cart_value}}/g, `₹${cart.cart_value}`)
      .replace(/{{item_list}}/g, itemList)
      .replace(/{{checkout_url}}/g, cart.checkout_url || '')
    
    // Send via WhatsApp Business API
    const result = await sendWhatsAppMessage({
      phoneId: cart.store.whatsapp_phone_id!,
      accessToken: cart.store.whatsapp_access_token!,
      to: formatPhoneNumber(cart.customer_phone),
      body: messageBody,
    })
    
    if (result.success) {
      // Update cart status
      await supabaseAdmin
        .from('abandoned_carts')
        .update({
          status: 'messaged',
          message_sent_at: new Date().toISOString(),
        })
        .eq('id', cartId)
      
      // Log message
      await supabaseAdmin
        .from('messages')
        .insert({
          cart_id: cartId,
          store_id: cart.store_id,
          phone: cart.customer_phone,
          template_name: template?.name || 'default',
          body: messageBody,
          status: 'sent',
          whatsapp_message_id: result.messageId,
        })
      
      // Update analytics
      await incrementMessageSent(cart.store_id)
      
      return NextResponse.json({ success: true, messageId: result.messageId })
    } else {
      // Log failed message
      await supabaseAdmin
        .from('messages')
        .insert({
          cart_id: cartId,
          store_id: cart.store_id,
          phone: cart.customer_phone,
          template_name: template?.name || 'default',
          body: messageBody,
          status: 'failed',
          error_message: result.error,
        })
      
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    
  } catch (error: any) {
    console.error('Send WhatsApp error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ============================================
// Send via WhatsApp Cloud API
// ============================================
async function sendWhatsAppMessage({
  phoneId,
  accessToken,
  to,
  body,
}: {
  phoneId: string
  accessToken: string
  to: string
  body: string
}) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: {
            preview_url: false,
            body,
          },
        }),
      }
    )
    
    const data = await response.json()
    
    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'WhatsApp API error',
      }
    }
    
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    }
  }
}

// ============================================
// Helper functions
// ============================================
function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '')
  
  // Add country code if missing (assume India +91)
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned
  }
  
  return cleaned
}

function getDefaultTemplate(): string {
  return `Hi {{customer_name}}! 👋\n\nYou left something in your cart:\n\n{{item_list}}\n\nTotal: {{cart_value}}\n\nComplete your order: {{checkout_url}}\n\nNeed help? Just reply to this message!`
}

async function incrementMessageSent(storeId: string) {
  const today = new Date().toISOString().split('T')[0]
  
  const { data: existing } = await supabaseAdmin
    .from('analytics_daily')
    .select('*')
    .eq('store_id', storeId)
    .eq('date', today)
    .single()
  
  if (existing) {
    await supabaseAdmin
      .from('analytics_daily')
      .update({ messages_sent: existing.messages_sent + 1 })
      .eq('id', existing.id)
  } else {
    await supabaseAdmin
      .from('analytics_daily')
      .insert({ store_id: storeId, date: today, messages_sent: 1 })
  }
}