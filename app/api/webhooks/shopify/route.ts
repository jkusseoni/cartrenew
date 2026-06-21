export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server'
import { getTrackedRecoveryUrl } from '@/lib/recovery-link'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildRecoveryWhatsAppBody,
  hasTwilioWhatsAppCredentials,
  sendTwilioWhatsAppMessage,
} from '@/lib/services/twilio-whatsapp'
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
      case 'orders/paid':
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

function extractCustomerPhone(payload: Record<string, unknown>, customer: Record<string, unknown>) {
  const billing = payload.billing_address as Record<string, unknown> | undefined
  const shipping = payload.shipping_address as Record<string, unknown> | undefined
  const candidates = [
    customer.phone,
    payload.phone,
    billing?.phone,
    shipping?.phone,
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function extractCustomerEmail(payload: Record<string, unknown>, customer: Record<string, unknown>) {
  const billing = payload.billing_address as Record<string, unknown> | undefined
  const candidates = [
    customer.email,
    payload.email,
    payload.contact_email,
    billing?.email,
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase()
    }
  }

  return null
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

function phonesMatch(storedPhone: string | null | undefined, incomingPhone: string | null): boolean {
  if (!storedPhone || !incomingPhone) return false
  const a = normalizePhoneDigits(storedPhone)
  const b = normalizePhoneDigits(incomingPhone)
  if (!a || !b) return false
  if (a === b) return true
  // Match on last 10 digits for local vs E.164 formats.
  const aTail = a.slice(-10)
  const bTail = b.slice(-10)
  return aTail.length >= 10 && bTail.length >= 10 && aTail === bTail
}

function extractCustomerName(customer: Record<string, unknown>, payload: Record<string, unknown>) {
  const first = typeof customer.first_name === 'string' ? customer.first_name : ''
  const last = typeof customer.last_name === 'string' ? customer.last_name : ''
  const combined = `${first} ${last}`.trim()
  if (combined) return combined

  const billing = payload.billing_address as Record<string, unknown> | undefined
  if (billing) {
    const billingFirst = typeof billing.first_name === 'string' ? billing.first_name : ''
    const billingLast = typeof billing.last_name === 'string' ? billing.last_name : ''
    const billingName = `${billingFirst} ${billingLast}`.trim()
    if (billingName) return billingName
  }

  return null
}

async function dispatchWhatsAppRecovery({
  storeId,
  cartId,
  payload,
  customer,
  cartValue,
  items,
}: {
  storeId: string
  cartId: string
  payload: Record<string, unknown>
  customer: Record<string, unknown>
  cartValue: number
  items: unknown[]
  cartToken: string
}) {
  const customerPhone = extractCustomerPhone(payload, customer)
  const customerName = extractCustomerName(customer, payload)
  const currency =
    (typeof payload.currency === 'string' && payload.currency) ||
    (typeof payload.presentment_currency === 'string' && payload.presentment_currency) ||
    'USD'
  const recoveryLink = getTrackedRecoveryUrl(cartId)
  const messageBody = buildRecoveryWhatsAppBody({
    customerName,
    cartValue,
    currency,
    recoveryLink,
    items,
  })

  if (!customerPhone) {
    console.warn(`WhatsApp recovery skipped: missing phone for cart ${cartId}`)
    return
  }

  if (!hasTwilioWhatsAppCredentials()) {
    console.error(
      `Twilio WhatsApp credentials missing — cannot send recovery for cart ${cartId}`
    )
    return
  }

  const { data: messageRow, error: insertError } = await supabaseAdmin
    .from('messages')
    .insert({
      cart_id: cartId,
      store_id: storeId,
      phone: customerPhone,
      template_name: 'cart_recovery_twilio',
      body: messageBody,
      status: 'queued',
      attempt_count: 0,
      next_retry_at: null,
    })
    .select('id')
    .single()

  if (insertError || !messageRow?.id) {
    console.error('Failed to insert recovery message row:', insertError)
    return
  }

  const sendResult = await sendTwilioWhatsAppMessage(customerPhone, messageBody)

  if (sendResult.success) {
    await supabaseAdmin
      .from('messages')
      .update({
        status: 'sent',
        whatsapp_message_id: sendResult.messageSid || null,
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
      `✅ WhatsApp recovery sent for cart ${cartId} to ${customerPhone} via Twilio (${sendResult.messageSid}) — link: ${recoveryLink}`
    )
    return
  }

  await supabaseAdmin
    .from('messages')
    .update({
      status: 'pending',
      error_message: sendResult.error || 'twilio_send_failed',
      attempt_count: 1,
      next_retry_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    })
    .eq('id', messageRow.id)

  console.warn(
    `WhatsApp recovery dispatch failed for cart ${cartId} (${customerPhone}):`,
    sendResult.error ?? 'unknown'
  )
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
          customer_email: customer.email || payload.email || null,
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
        customer_email: customer.email || payload.email || null,
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
      await dispatchWhatsAppRecovery({
        storeId,
        cartId: insertedCart.id,
        payload,
        customer,
        cartValue,
        items,
        cartToken: token,
      })
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
        customer_email: customer.email || payload.email || null,
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
      await dispatchWhatsAppRecovery({
        storeId,
        cartId: insertedCart.id,
        payload,
        customer,
        cartValue,
        items,
        cartToken: token,
      })
    }
    
    await incrementAnalytics(storeId, 'carts_created')
  }
}

// ============================================
// Handle order created / paid (cart recovered!)
// ============================================
async function findAbandonedCartByToken(storeId: string, cartToken: string) {
  const { data } = await supabaseAdmin
    .from('abandoned_carts')
    .select('id, cart_value, status, customer_phone, customer_email')
    .eq('store_id', storeId)
    .eq('shopify_cart_token', String(cartToken))
    .maybeSingle()

  return data
}

async function findAbandonedCartByContact(
  storeId: string,
  phone: string | null,
  email: string | null
) {
  if (!phone && !email) return null

  const { data: carts, error } = await supabaseAdmin
    .from('abandoned_carts')
    .select('id, cart_value, status, customer_phone, customer_email, created_at')
    .eq('store_id', storeId)
    .in('status', ['pending', 'messaged'])
    .order('created_at', { ascending: false })

  if (error || !carts?.length) return null

  for (const cart of carts) {
    if (email && cart.customer_email?.toLowerCase() === email) {
      return cart
    }
    if (phonesMatch(cart.customer_phone, phone)) {
      return cart
    }
  }

  return null
}

async function markCartRecovered(
  storeId: string,
  cart: { id: string; cart_value: number | string }
) {
  const { data: updated, error } = await supabaseAdmin
    .from('abandoned_carts')
    .update({
      status: 'recovered',
      recovery_completed_at: new Date().toISOString(),
    })
    .eq('id', cart.id)
    .in('status', ['pending', 'messaged'])
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('Failed to mark cart recovered:', error)
    return false
  }

  if (!updated) {
    return false
  }

  await incrementAnalytics(storeId, 'carts_recovered', Number(cart.cart_value) || 0)
  console.log(`Cart ${cart.id} marked as recovered from order webhook`)
  return true
}

async function handleOrderCreated(storeId: string, payload: any) {
  const customer = payload.customer || {}
  const cartToken =
    payload.cart_token || payload.checkout_token || payload.checkout_id || null
  const phone = extractCustomerPhone(payload, customer)
  const email = extractCustomerEmail(payload, customer)

  let cart =
    cartToken != null ? await findAbandonedCartByToken(storeId, String(cartToken)) : null

  if (!cart || (cart.status !== 'pending' && cart.status !== 'messaged')) {
    const contactMatch = await findAbandonedCartByContact(storeId, phone, email)
    if (contactMatch) {
      cart = contactMatch
    }
  }

  if (!cart) {
    console.log('No matching pending abandoned cart for order recovery', {
      storeId,
      cartToken,
      phone,
      email,
    })
    return
  }

  if (cart.status !== 'pending' && cart.status !== 'messaged') {
    return
  }

  await markCartRecovered(storeId, cart)
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