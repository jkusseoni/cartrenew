import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_APP_API_SECRET!

// Verify Shopify webhook signature
function verifyWebhook(body: string, hmac: string): boolean {
  const generatedHmac = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64')
  return crypto.timingSafeEqual(
    Buffer.from(generatedHmac),
    Buffer.from(hmac)
  )
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
    
    // Verify webhook
    if (!verifyWebhook(body, hmac)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    const payload = JSON.parse(body)
    
    // Find the store
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('shopify_domain', shopDomain)
      .single()
    
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }
    
    switch (topic) {
      case 'carts/create':
      case 'carts/update':
        await handleCartWebhook(store.id, payload)
        break
      
      case 'checkouts/create':
      case 'checkouts/update':
        await handleCheckoutWebhook(store.id, payload)
        break
      
      case 'orders/create':
        await handleOrderCreated(store.id, payload)
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
    
    await supabaseAdmin
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
    
    await supabaseAdmin
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