export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { queueRecoveryMessageForCart } from '@/lib/services/messaging'
import { verifyWebhookHmac } from '@/lib/shopify/config'

const SHOPIFY_WEBHOOK_VERIFY = process.env.SHOPIFY_WEBHOOK_VERIFY !== 'false'
const SHOPIFY_WEBHOOK_BYPASS = process.env.SHOPIFY_WEBHOOK_BYPASS === 'true'

function shouldSkipVerification(req: NextRequest): boolean {
  if (!SHOPIFY_WEBHOOK_VERIFY) {
    return true
  }

  const bypassHeader = req.headers.get('x-shopify-webhook-skip-verify')
  if (
    bypassHeader?.toLowerCase() === 'true' &&
    process.env.NODE_ENV !== 'production'
  ) {
    return true
  }

  if (SHOPIFY_WEBHOOK_BYPASS && process.env.NODE_ENV !== 'production') {
    return true
  }

  return false
}

// ============================================
// POST /api/webhooks/shopify
// Handles cart creation and update webhooks from Shopify
// ============================================
export async function POST(req: NextRequest) {
  try {
    const hmac = req.headers.get('x-shopify-hmac-sha256') || ''
    const shopDomain = req.headers.get('x-shopify-shop-domain') || ''
    const topic = req.headers.get('x-shopify-topic') || ''
    
    const body = await req.text()
    
    // Verify webhook unless bypass is enabled for local/staging testing.
    if (!shouldSkipVerification(req) && !verifyWebhookHmac(body, hmac)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    const payload = JSON.parse(body)

    console.log("🔥 LIVE WEBHOOK RECEIVED:", { topic, shop: shopDomain, payload })

    if (!shopDomain) {
      return NextResponse.json({ error: 'Missing X-Shopify-Shop-Domain header' }, { status: 400 })
    }

    const store = await getOrCreateStore(shopDomain)
    if (!store?.id) {
      return NextResponse.json({ error: 'Failed to resolve store for webhook' }, { status: 500 })
    }

    const storeId = store.id

    switch (topic) {
      case 'carts/create':
      case 'carts/update':
        await handleCartWebhook(storeId, payload)
        break

      case 'carts/delete':
        await handleCartDelete(storeId, payload)
        break
      
      case 'checkouts/create':
      case 'checkouts/update':
        await handleCheckoutWebhook(storeId, payload)
        break
      
      case 'orders/create':
        await handleOrderCreated(storeId, payload)
        break

      case 'app/uninstalled':
        await handleAppUninstalled(storeId, shopDomain)
        break
      
      default:
        console.log(`Unhandled webhook topic: ${topic}`)
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Shopify webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function getOrCreateStore(shopDomain: string) {
  const { data: existingStore, error: fetchError } = await supabaseAdmin
    .from('stores')
    .select('id, shopify_access_token')
    .eq('shopify_domain', shopDomain)
    .maybeSingle()

  if (fetchError) {
    throw fetchError
  }

  if (existingStore) {
    return existingStore
  }

  const clerkUserId = `webhook_${shopDomain.replace(/[^a-z0-9]/gi, '_')}`
  const { data: insertedStore, error: insertError } = await supabaseAdmin
    .from('stores')
    .insert({
      shopify_domain: shopDomain,
      shopify_access_token: null,
      clerk_user_id: clerkUserId,
      webhook_ids: [],
      whatsapp_phone_id: null,
      whatsapp_access_token: null,
    })
    .select('id, shopify_access_token')
    .single()

  if (insertError) {
    throw insertError
  }

  return insertedStore
}

// ============================================
// Handle cart create/update
// ============================================
async function handleCartWebhook(storeId: string, payload: any) {
  const token = payload.token || payload.id
  const customer = payload.customer || {}
  
  // Extract line items
  const items = (payload.line_items || []).map((item: any) => ({
    title: item.title,
    quantity: item.quantity,
    price: item.price,
    variant_id: item.variant_id,
    product_id: item.product_id,
    image: item.image || null,
  }))
  
  const cartValue = items.reduce((sum: number, item: any) => {
    return sum + (parseFloat(item.price || 0) * (item.quantity || 1))
  }, 0)
  
  // Check if cart already exists
  const { data: existingCart } = await supabaseAdmin
    .from('abandoned_carts')
    .select('id, status')
    .eq('store_id', storeId)
    .eq('shopify_cart_token', token)
    .single()
  
  if (existingCart) {
    // Only update if not already recovered or messaged
    if (existingCart.status === 'pending') {
      await supabaseAdmin
        .from('abandoned_carts')
        .update({
          customer_phone: customer.phone || null,
          customer_email: customer.email || null,
          customer_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || null,
          cart_value: cartValue,
          items,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCart.id)
    }
  } else {
    // Create new abandoned cart with scheduled message time
    const delayMinutes = 60 // Default 1 hour
    const scheduledAt = new Date(Date.now() + delayMinutes * 60000)
    
    const { data: insertedCart, error: insertError } = await supabaseAdmin
      .from('abandoned_carts')
      .insert({
        store_id: storeId,
        shopify_cart_token: token,
        customer_phone: customer.phone || null,
        customer_email: customer.email || null,
        customer_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || null,
        cart_value: cartValue,
        items,
        checkout_url: payload.abandoned_checkout_url || null,
        status: 'pending',
        scheduled_message_at: scheduledAt.toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert abandoned cart', insertError)
      return
    }

    if (insertedCart?.id) {
      const queued = await queueRecoveryMessageForCart({
        storeId,
        cartId: insertedCart.id,
        customerPhone: customer.phone || null,
        customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || null,
        checkoutUrl: payload.abandoned_checkout_url || null,
        cartValue,
        items,
        customerEmail: customer.email || null,
        cartToken: token,
      })

      if (!queued) {
        console.warn(`Recovery message queue failed for cart ${insertedCart.id}`)
      }
    }

    // Update analytics
    await incrementAnalytics(storeId, 'carts_created')
  }
}

// ============================================
// Handle checkout create/update
// ============================================
async function handleCheckoutWebhook(storeId: string, payload: any) {
  const token = payload.token || payload.id
  const customer = payload.customer || {}
  
  const items = (payload.line_items || []).map((item: any) => ({
    title: item.title,
    quantity: item.quantity,
    price: item.price,
    variant_id: item.variant_id,
    product_id: item.product_id,
  }))
  
  const cartValue = items.reduce((sum: number, item: any) => {
    return sum + (parseFloat(item.price || 0) * (item.quantity || 1))
  }, 0)
  
  // Upsert abandoned cart
  const { data: existingCart } = await supabaseAdmin
    .from('abandoned_carts')
    .select('id, status')
    .eq('store_id', storeId)
    .eq('shopify_cart_token', token)
    .single()
  
  if (!existingCart) {
    const scheduledAt = new Date(Date.now() + 60 * 60000)
    
    const { data: insertedCart, error: insertError } = await supabaseAdmin
      .from('abandoned_carts')
      .insert({
        store_id: storeId,
        shopify_cart_token: token,
        customer_phone: customer.phone || null,
        customer_email: customer.email || null,
        customer_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || null,
        cart_value: cartValue,
        items,
        checkout_url: payload.abandoned_checkout_url || null,
        status: 'pending',
        scheduled_message_at: scheduledAt.toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert abandoned checkout', insertError)
      return
    }

    if (insertedCart?.id) {
      const queued = await queueRecoveryMessageForCart({
        storeId,
        cartId: insertedCart.id,
        customerPhone: customer.phone || null,
        customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || null,
        checkoutUrl: payload.abandoned_checkout_url || null,
        cartValue,
        items,
        customerEmail: customer.email || null,
        cartToken: token,
      })

      if (!queued) {
        console.warn(`Recovery message queue failed for cart ${insertedCart.id}`)
      }
    }
    
    await incrementAnalytics(storeId, 'carts_created')
  }
}

// ============================================
// Handle order created (cart recovered!)
// ============================================
async function handleOrderCreated(storeId: string, payload: any) {
  const cartToken = payload.cart_token || payload.checkout_token
  
  if (!cartToken) return
  
  // Find and mark the cart as recovered
  const { data: cart } = await supabaseAdmin
    .from('abandoned_carts')
    .select('id, cart_value')
    .eq('store_id', storeId)
    .eq('shopify_cart_token', cartToken)
    .single()
  
  if (cart) {
    await supabaseAdmin
      .from('abandoned_carts')
      .update({
        status: 'recovered',
        recovery_completed_at: new Date().toISOString(),
      })
      .eq('id', cart.id)
    
    // Update analytics
    await incrementAnalytics(storeId, 'carts_recovered', cart.cart_value)
  }
}

// ============================================
// Helper: Increment analytics counter
// ============================================
async function incrementAnalytics(
  storeId: string,
  field: string,
  value?: number
) {
  const today = new Date().toISOString().split('T')[0]
  
  const { data: existing } = await supabaseAdmin
    .from('analytics_daily')
    .select('*')
    .eq('store_id', storeId)
    .eq('date', today)
    .single()
  
  if (existing) {
    const updates: any = {}
    if (field === 'carts_created') updates.carts_created = existing.carts_created + 1
    if (field === 'carts_recovered') {
      updates.carts_recovered = existing.carts_recovered + 1
      updates.revenue_recovered = (existing.revenue_recovered || 0) + (value || 0)
    }
    
    await supabaseAdmin
      .from('analytics_daily')
      .update(updates)
      .eq('id', existing.id)
  } else {
    await supabaseAdmin
      .from('analytics_daily')
      .insert({
        store_id: storeId,
        date: today,
        [field]: 1,
        ...(field === 'carts_recovered' ? { revenue_recovered: value || 0 } : {}),
      })
  }
}

// ============================================
// Handle cart delete
// ============================================
async function handleCartDelete(storeId: string, payload: any) {
  const token = payload.token || payload.id
  if (!token) return

  const { data: cart } = await supabaseAdmin
    .from('abandoned_carts')
    .select('id, status')
    .eq('store_id', storeId)
    .eq('shopify_cart_token', token)
    .single()

  if (cart) {
    await supabaseAdmin
      .from('abandoned_carts')
      .update({ status: 'lost', updated_at: new Date().toISOString() })
      .eq('id', cart.id)
  }
}

// ============================================
// Handle app uninstall
// ============================================
async function handleAppUninstalled(storeId: string, shopDomain: string) {
  try {
    // Mark all carts for this store as lost
    await supabaseAdmin
      .from('abandoned_carts')
      .update({ status: 'lost', updated_at: new Date().toISOString() })
      .eq('store_id', storeId)

    // Optionally remove the store record to avoid further sends
    await supabaseAdmin
      .from('stores')
      .delete()
      .eq('id', storeId)

    console.log(`Store uninstalled: ${shopDomain}, cleaned up data`)
  } catch (err) {
    console.error('Error handling app uninstall for', shopDomain, err)
  }
}