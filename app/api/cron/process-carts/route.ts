import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { alertEvent } from '@/lib/monitoring'

const CRON_SECRET = process.env.CRON_SECRET || 'your-cron-secret'
const MAX_SEND_ATTEMPTS = 5

// ============================================
// GET /api/cron/process-carts
// Process pending carts and send scheduled messages
// Called by a cron job every 5 minutes
// ============================================
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Find all carts that are past their scheduled message time
    const { data: pendingCarts, error } = await supabaseAdmin
      .from('abandoned_carts')
      .select(`
        *,
        store:stores(*)
      `)
      .eq('status', 'pending')
      .lte('scheduled_message_at', new Date().toISOString())
      .not('customer_phone', 'is', null)
      .limit(50) // Process in batches
    
    if (error || !pendingCarts || pendingCarts.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No carts to process' })
    }
    
    const results = []
    
    for (const cart of pendingCarts) {
      try {
        // Claim the cart for processing to avoid duplicate sends from concurrent runners
        const nowISO = new Date().toISOString()
        const { data: claimed, error: claimError } = await supabaseAdmin
          .from('abandoned_carts')
          .update({
            status: 'processing',
            attempts: (cart.attempts ?? 0) + 1,
            processing_started_at: nowISO,
          })
          .eq('id', cart.id)
          .eq('status', 'pending')
          .select('id,attempts,status')
          .single()

        if (claimError || !claimed) {
          results.push({ cart: cart.id, status: 'skipped', reason: 'claimed_by_other' })
          continue
        }

        // Stop retrying after max attempts
        if ((claimed.attempts ?? 0) > MAX_SEND_ATTEMPTS) {
          await supabaseAdmin
            .from('abandoned_carts')
            .update({ status: 'failed_permanently' })
            .eq('id', cart.id)

          // alert for operators
          try {
            await alertEvent('error', 'cron/process-carts', 'failed_permanently', { cartId: cart.id, storeId: cart.store_id, attempts: claimed.attempts })
          } catch (e) {
            console.error('alertEvent error', e)
          }

          results.push({ cart: cart.id, status: 'failed_permanently' })
          continue
        }

        // Skip if store doesn't have WhatsApp configured
        if (!cart.store?.whatsapp_phone_id || !cart.store?.whatsapp_access_token) {
          // release claim and mark skipped
          await supabaseAdmin
            .from('abandoned_carts')
            .update({ status: 'pending' })
            .eq('id', cart.id)

          results.push({ cart: cart.id, status: 'skipped', reason: 'WhatsApp not configured' })
          continue
        }
        
        // Get template for this store
        const { data: template } = await supabaseAdmin
          .from('message_templates')
          .select('*')
          .eq('store_id', cart.store_id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .single()
        
        // Build message
        let messageBody = template?.body || getDefaultTemplate()
        const customerName = cart.customer_name || 'there'
        const items = Array.isArray(cart.items) ? cart.items : []
        const itemList = items.map((i: any) => `• ${i.title} (x${i.quantity})`).join('\n')
        
        messageBody = messageBody
          .replace(/{{customer_name}}/g, customerName)
          .replace(/{{cart_value}}/g, `₹${cart.cart_value}`)
          .replace(/{{item_list}}/g, itemList)
          .replace(/{{checkout_url}}/g, cart.checkout_url || '')
        
        // Send WhatsApp message
        const waResult = await sendWhatsAppMessage({
          phoneId: cart.store.whatsapp_phone_id,
          accessToken: cart.store.whatsapp_access_token,
          to: formatPhoneNumber(cart.customer_phone),
          body: messageBody,
        })
        
        if (waResult.success) {
          // Update cart status
          await supabaseAdmin
            .from('abandoned_carts')
            .update({
              status: 'messaged',
              message_sent_at: new Date().toISOString(),
              processing_started_at: null,
            })
            .eq('id', cart.id)
          
          // Log message
          await supabaseAdmin
            .from('messages')
            .insert({
              cart_id: cart.id,
              store_id: cart.store_id,
              phone: cart.customer_phone,
              template_name: template?.name || 'default',
              body: messageBody,
              status: 'sent',
              whatsapp_message_id: waResult.messageId,
            })
          
          // Update analytics
          await incrementMessageSent(cart.store_id)
          
          results.push({ cart: cart.id, status: 'sent', messageId: waResult.messageId })
        } else {
          // Mark as failed but don't retry immediately
          await supabaseAdmin
            .from('messages')
            .insert({
              cart_id: cart.id,
              store_id: cart.store_id,
              phone: cart.customer_phone,
              template_name: template?.name || 'default',
              body: messageBody,
              status: 'failed',
              error_message: waResult.error,
              attempts: (claimed.attempts ?? 0),
            })
          
          // Reschedule with progressive backoff based on attempts
          const backoffMinutes = Math.min(30 * (claimed.attempts ?? 1), 24 * 60) // cap at 1 day
          await supabaseAdmin
            .from('abandoned_carts')
            .update({
              scheduled_message_at: new Date(Date.now() + backoffMinutes * 60000).toISOString(),
              status: 'pending',
            })
            .eq('id', cart.id)
          
          results.push({ cart: cart.id, status: 'failed', error: waResult.error })
        }
        
      } catch (cartError: any) {
        results.push({ cart: cart.id, status: 'error', error: cartError.message })
      }
      
      // Small delay to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    
    return NextResponse.json({
      processed: pendingCarts.length,
      results,
    })
    
  } catch (error: any) {
    console.error('Process carts error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ============================================
// WhatsApp API sender
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
          to,
          type: 'text',
          text: { body },
        }),
      }
    )
    
    const data = await response.json()
    
    if (!response.ok) {
      return { success: false, error: data.error?.message || 'WhatsApp API error' }
    }
    
    return { success: true, messageId: data.messages?.[0]?.id }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ============================================
// Helpers
// ============================================
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) cleaned = '91' + cleaned
  return cleaned
}

function getDefaultTemplate(): string {
  return `Hi {{customer_name}}! 👋\n\nYou left something in your cart:\n\n{{item_list}}\n\nTotal: {{cart_value}}\n\nComplete your order: {{checkout_url}}\n\nNeed help? Just reply!`
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