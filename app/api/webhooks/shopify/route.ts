export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server'
import { getTrackedRecoveryUrl } from '@/lib/recovery-link'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildAbandonedCartContentVariables,
  buildRecoveryWhatsAppBody,
  getTwilioAbandonedCartContentSid,
  hasTwilioWhatsAppCredentials,
  resolveRecoveryCustomerName,
  sendTwilioWhatsAppMessage,
} from '@/lib/services/twilio-whatsapp'
import {
  getShopifyWebhookSecret,
  getShopifyWebhookSecretSource,
  verifyWebhookHmacDetailed,
} from '@/lib/shopify/config'
import {
  inferPlanIdFromSubscriptionName,
  toDbBillingStatus,
} from '@/lib/shopify/billing'
import {
  buildAbandonedCartUpdate,
  shouldDispatchCartRecovery,
} from '@/lib/services/abandoned-cart-webhook'

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
// Handles cart + checkout abandonment webhooks from Shopify
// (Shopify should point checkouts/create + checkouts/update HERE — not /api/cart-recovery)
// ============================================
export async function POST(req: NextRequest) {
  // First line of the handler — raw headers before body parse / HMAC.
  console.log('📥 Shopify webhook HIT /api/webhooks/shopify', {
    method: req.method,
    url: req.url,
    topic: req.headers.get('x-shopify-topic'),
    shop: req.headers.get('x-shopify-shop-domain'),
    webhookId: req.headers.get('x-shopify-webhook-id'),
    hmacPresent: Boolean(req.headers.get('x-shopify-hmac-sha256')),
    contentType: req.headers.get('content-type'),
  })

  try {
    const hmac = req.headers.get('x-shopify-hmac-sha256') || ''
    const shopDomain = req.headers.get('x-shopify-shop-domain') || ''
    const topic = req.headers.get('x-shopify-topic') || ''
    
    const body = await req.text()

    console.log('📦 Shopify webhook raw body (checkouts/update JSON):', {
      topic,
      shop: shopDomain,
      bodyLength: body.length,
      bodyPreview: body.slice(0, 2000),
      fullBody: body,
    })
    
    // Verify webhook HMAC with SHOPIFY_API_SECRET (X-Shopify-Hmac-SHA256).
    if (!shouldSkipVerification(req)) {
      const secretSource = getShopifyWebhookSecretSource()
      const secretValue = getShopifyWebhookSecret()
      console.log('🔐 Shopify webhook HMAC check', {
        envVar: secretSource ?? '(none loaded)',
        secretPrefix: secretValue ? `${secretValue.slice(0, 4)}…` : '(empty)',
        secretLength: secretValue.length,
        hmacHeaderPresent: Boolean(hmac),
        bodyBytes: Buffer.byteLength(body, 'utf8'),
      })

      const verification = verifyWebhookHmacDetailed(body, hmac)

      if (!verification.ok) {
        if (verification.reason === 'missing_secret') {
          console.error(
            '❌ Shopify webhook HMAC failed: SHOPIFY_API_SECRET is missing in this environment. Set it in Vercel/env to the app Client secret (shpss_…) from Partner Dashboard → Client credentials.'
          )
          return NextResponse.json(
            { error: 'Webhook secret not configured', reason: 'missing_secret' },
            { status: 401 }
          )
        }

        if (verification.reason === 'missing_hmac_header') {
          console.error(
            '❌ Shopify webhook HMAC failed: missing X-Shopify-Hmac-SHA256 header'
          )
          return NextResponse.json(
            { error: 'Missing HMAC header', reason: 'missing_hmac_header' },
            { status: 401 }
          )
        }

        console.error(
          '❌ Shopify webhook HMAC failed: signature mismatch using',
          verification.secretSource ?? secretSource,
          '| SHOPIFY_API_SECRET must exactly match the Client secret Shopify used to sign this webhook. Do not use SHOPIFY_WEBHOOK_SECRET.'
        )
        return NextResponse.json(
          { error: 'Invalid signature', reason: 'hmac_mismatch' },
          { status: 401 }
        )
      }

      console.log(
        '✅ Shopify webhook HMAC verified using',
        verification.secretSource
      )
    } else {
      console.warn('⚠️ Shopify webhook HMAC verification skipped (dev bypass)')
    }
    
    const payload = JSON.parse(body)

    console.log('🔥 LIVE WEBHOOK RECEIVED (parsed Abandoned Checkout payload):', {
      topic,
      shop: shopDomain,
      checkoutToken: payload?.token ?? null,
      checkoutId: payload?.id ?? null,
      email: payload?.email ?? null,
      phone: payload?.phone ?? null,
      abandonedCheckoutUrl: payload?.abandoned_checkout_url ?? null,
      lineItemCount: Array.isArray(payload?.line_items) ? payload.line_items.length : 0,
      customer: payload?.customer ?? null,
      shipping_address: payload?.shipping_address ?? null,
      billing_address: payload?.billing_address ?? null,
      payload,
    })

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

      case 'app_subscriptions/update':
        await handleAppSubscriptionUpdate(storeId, shopDomain, payload)
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

function asPhoneString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function extractCustomerPhone(payload: Record<string, unknown>, customer: Record<string, unknown>) {
  const billing = payload.billing_address as Record<string, unknown> | undefined
  const shipping = payload.shipping_address as Record<string, unknown> | undefined

  // Prefer shipping_address.phone, then customer.phone.
  const fromShipping = asPhoneString(shipping?.phone)
  if (fromShipping) return fromShipping

  const fromCustomer = asPhoneString(customer.phone)
  if (fromCustomer) return fromCustomer

  const candidates = [
    payload.phone,
    billing?.phone,
    // Some Shopify payloads nest contact phone under default_address.
    (customer.default_address as Record<string, unknown> | undefined)?.phone,
  ]

  for (const value of candidates) {
    const phone = asPhoneString(value)
    if (phone) return phone
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

  const shipping = payload.shipping_address as Record<string, unknown> | undefined
  if (shipping) {
    const shippingFirst = typeof shipping.first_name === 'string' ? shipping.first_name : ''
    const shippingLast = typeof shipping.last_name === 'string' ? shipping.last_name : ''
    const shippingName = `${shippingFirst} ${shippingLast}`.trim()
    if (shippingName) return shippingName
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
  persistMessageRow = true,
}: {
  storeId: string
  cartId: string
  payload: Record<string, unknown>
  customer: Record<string, unknown>
  cartValue: number
  items: unknown[]
  cartToken: string
  persistMessageRow?: boolean
}) {
  const shippingAddress = payload.shipping_address ?? null
  console.log(
    `📞 Phone lookup for cart ${cartId} — customer.phone:`,
    customer.phone ?? null,
    '| shipping_address:',
    JSON.stringify(shippingAddress, null, 2)
  )

  // Prefer shipping_address.phone, then customer.phone (see extractCustomerPhone).
  const customerPhone = extractCustomerPhone(payload, customer)
  const customerName = resolveRecoveryCustomerName(extractCustomerName(customer, payload))
  const currency =
    (typeof payload.currency === 'string' && payload.currency) ||
    (typeof payload.presentment_currency === 'string' && payload.presentment_currency) ||
    'USD'
  const recoveryLink = getTrackedRecoveryUrl(cartId)
  const checkoutUrl =
    (typeof payload.abandoned_checkout_url === 'string' && payload.abandoned_checkout_url) ||
    recoveryLink
  const contentSid = getTwilioAbandonedCartContentSid()
  const contentVariables = buildAbandonedCartContentVariables({
    customerName,
    checkoutUrl,
    items,
  })
  const messageBody = buildRecoveryWhatsAppBody({
    customerName,
    cartValue,
    currency,
    recoveryLink: checkoutUrl,
    items,
  })

  if (!customerPhone) {
    console.warn(
      `WhatsApp recovery skipped: missing phone for cart ${cartId}. customer.phone=${String(customer.phone ?? 'undefined')}, shipping_address.phone=${String((shippingAddress as Record<string, unknown> | null)?.phone ?? 'undefined')}. Full payload:`,
      JSON.stringify(payload, null, 2)
    )
    return
  }

  if (!checkoutUrl) {
    console.warn(`WhatsApp recovery skipped: missing checkout URL for cart ${cartId}`)
    return
  }

  if (!hasTwilioWhatsAppCredentials()) {
    console.error(
      `Twilio WhatsApp credentials missing — cannot send recovery for cart ${cartId}`
    )
    return
  }

  if (!contentSid) {
    console.error(
      `TWILIO_ABANDONED_CART_CONTENT_SID (or TWILIO_CONTENT_SID) missing — cannot send Abandoned Cart Content template for cart ${cartId}. Set the dedicated abandoned-cart ContentSid in env (not the appointment reminder template).`
    )
    return
  }

  let messageRowId: string | null = null

  if (persistMessageRow) {
    const { data: messageRow, error: insertError } = await supabaseAdmin
      .from('messages')
      .insert({
        cart_id: cartId,
        store_id: storeId,
        phone: customerPhone,
        template_name: contentSid,
        body: messageBody,
        status: 'queued',
        attempt_count: 0,
        next_retry_at: null,
      })
      .select('id')
      .single()

    if (insertError || !messageRow?.id) {
      logSupabaseError(
        'Failed to insert recovery message row — continuing Twilio send anyway',
        insertError
      )
    } else {
      messageRowId = messageRow.id
    }
  } else {
    console.warn(
      `Skipping messages row persist for cart ${cartId} (abandoned_carts row missing) — still sending WhatsApp`
    )
  }

  console.log('📤 Dispatching Twilio Content template WhatsApp recovery', {
    cartId,
    to: customerPhone,
    contentSid,
    contentVariables,
    checkoutUrl,
  })

  const sendResult = await sendTwilioWhatsAppMessage(customerPhone, {
    contentSid,
    contentVariables,
  })

  console.log('📨 Twilio WhatsApp message status:', {
    cartId,
    success: sendResult.success,
    status: sendResult.status ?? (sendResult.success ? 'accepted' : 'failed'),
    messageSid: sendResult.messageSid ?? null,
    to: sendResult.to ?? customerPhone,
    contentSid: sendResult.contentSid ?? contentSid,
    apiHost: sendResult.apiHost ?? null,
    error: sendResult.error ?? null,
  })

  if (sendResult.success) {
    if (messageRowId) {
      await supabaseAdmin
        .from('messages')
        .update({
          status: 'sent',
          whatsapp_message_id: sendResult.messageSid || null,
          sent_at: new Date().toISOString(),
          attempt_count: 1,
          error_message: null,
        })
        .eq('id', messageRowId)
    }

    // Only mark messaged when we have a real abandoned_carts UUID row.
    if (persistMessageRow) {
      await supabaseAdmin
        .from('abandoned_carts')
        .update({
          status: 'messaged',
          message_sent_at: new Date().toISOString(),
        })
        .eq('id', cartId)
        .eq('status', 'pending')
    }

    console.log(
      `✅ WhatsApp recovery sent for cart ${cartId} to ${customerPhone} via Twilio ContentSid ${contentSid} (${sendResult.messageSid}, status=${sendResult.status}) — link: ${checkoutUrl}`
    )
    return
  }

  if (messageRowId) {
    await supabaseAdmin
      .from('messages')
      .update({
        status: 'pending',
        error_message: sendResult.error || 'twilio_send_failed',
        attempt_count: 1,
        next_retry_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      })
      .eq('id', messageRowId)
  }

  console.warn(
    `❌ WhatsApp recovery dispatch failed for cart ${cartId} (${customerPhone}):`,
    sendResult.error ?? 'unknown',
    `| status=${sendResult.status}`
  )
}

function logSupabaseError(context: string, error: unknown) {
  if (!error || typeof error !== 'object') {
    console.error(context, error)
    return
  }
  const row = error as Record<string, unknown>
  console.error(context, {
    message: row.message ?? null,
    code: row.code ?? null,
    details: row.details ?? null,
    hint: row.hint ?? null,
  })
}

function normalizeCheckoutToken(payload: Record<string, unknown>): string | null {
  const raw = payload.token ?? payload.id ?? payload.cart_token
  if (raw === undefined || raw === null) return null
  const token = String(raw).trim()
  return token || null
}

function normalizeLineItems(payload: Record<string, unknown>) {
  const lineItems = Array.isArray(payload.line_items) ? payload.line_items : []
  return lineItems.map((item: any) => ({
    title: item?.title ?? item?.name ?? 'item',
    quantity: Number(item?.quantity) || 1,
    price: item?.price ?? '0',
    variant_id: item?.variant_id ?? null,
    product_id: item?.product_id ?? null,
    image: item?.image ?? null,
  }))
}

function sumCartValue(items: Array<{ price?: unknown; quantity?: number }>) {
  return items.reduce((sum, item) => {
    return sum + (parseFloat(String(item.price || 0)) * (item.quantity || 1))
  }, 0)
}

type AbandonedCartRow = {
  id: string
  status: string
  customer_phone: string | null
}

/**
 * Upsert abandoned cart by unique (store_id, shopify_cart_token).
 * Omits `status` so inserts get DEFAULT 'pending' and updates preserve recovered/messaged.
 */
async function upsertAbandonedCartRecord({
  storeId,
  token,
  customerPhone,
  customerEmail,
  customerName,
  cartValue,
  items,
  checkoutUrl,
}: {
  storeId: string
  token: string
  customerPhone: string | null
  customerEmail: string | null
  customerName: string | null
  cartValue: number
  items: unknown[]
  checkoutUrl: string | null
}): Promise<{ cart: AbandonedCartRow | null; error: unknown | null; created: boolean }> {
  const safeItems = Array.isArray(items) ? items : []
  const safeValue = Number.isFinite(cartValue) ? cartValue : 0

  const { data: existing } = await supabaseAdmin
    .from('abandoned_carts')
    .select('id, status, customer_phone')
    .eq('store_id', storeId)
    .eq('shopify_cart_token', token)
    .maybeSingle()

  const baseRow = {
    store_id: storeId,
    shopify_cart_token: token,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    customer_name: customerName,
    cart_value: safeValue,
    items: safeItems,
    checkout_url: checkoutUrl,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    // Don't overwrite terminal statuses with fresh checkout noise beyond contact/items.
    if (existing.status !== 'pending' && existing.status !== 'messaged') {
      return { cart: existing as AbandonedCartRow, error: null, created: false }
    }

    const { data, error } = await supabaseAdmin
      .from('abandoned_carts')
      .update(buildAbandonedCartUpdate(baseRow))
      .eq('id', existing.id)
      .select('id, status, customer_phone')
      .maybeSingle()

    if (error) {
      logSupabaseError('Failed to update abandoned cart', error)
      return { cart: existing as AbandonedCartRow, error, created: false }
    }

    return {
      cart: (data as AbandonedCartRow | null) ?? (existing as AbandonedCartRow),
      error: null,
      created: false,
    }
  }

  const scheduledAt = new Date(Date.now() + 60 * 60000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('abandoned_carts')
    .upsert(
      {
        ...baseRow,
        status: 'pending',
        scheduled_message_at: scheduledAt,
      },
      { onConflict: 'store_id,shopify_cart_token' }
    )
    .select('id, status, customer_phone')
    .maybeSingle()

  if (error) {
    logSupabaseError('Failed to upsert abandoned checkout', error)

    // Race: another webhook inserted between select and upsert — re-read.
    const { data: raced, error: readError } = await supabaseAdmin
      .from('abandoned_carts')
      .select('id, status, customer_phone')
      .eq('store_id', storeId)
      .eq('shopify_cart_token', token)
      .maybeSingle()

    if (readError) {
      logSupabaseError('Failed to re-read abandoned checkout after upsert error', readError)
    }

    return {
      cart: (raced as AbandonedCartRow | null) ?? null,
      error,
      created: false,
    }
  }

  return {
    cart: (data as AbandonedCartRow | null) ?? null,
    error: null,
    created: !existing,
  }
}

// ============================================
// Handle cart create/update
// ============================================
async function handleCartWebhook(storeId: string, payload: any) {
  const token = normalizeCheckoutToken(payload)
  const customer = (payload.customer || {}) as Record<string, unknown>

  if (!token) {
    console.error('Failed to upsert abandoned cart: missing checkout/cart token', {
      message: 'payload.token / payload.id missing',
      code: 'MISSING_TOKEN',
    })
    return
  }

  const items = normalizeLineItems(payload)
  const cartValue = sumCartValue(items)
  const customerPhone = extractCustomerPhone(payload, customer)
  const customerEmail = extractCustomerEmail(payload, customer)
  const customerName = extractCustomerName(customer, payload)
  const checkoutUrl =
    (typeof payload.abandoned_checkout_url === 'string' && payload.abandoned_checkout_url) ||
    null

  const { cart, error, created } = await upsertAbandonedCartRecord({
    storeId,
    token,
    customerPhone,
    customerEmail,
    customerName,
    cartValue,
    items,
    checkoutUrl,
  })

  const recoveryCartId = cart?.id || token
  const canSendWhatsApp = Boolean(customerPhone && (checkoutUrl || cart?.id))

  if (error && !cart) {
    console.error('Abandoned cart upsert failed — continuing WhatsApp if contact is valid', {
      message: (error as { message?: string })?.message ?? null,
      code: (error as { code?: string })?.code ?? null,
      token,
    })
  }

  if (created && cart?.id) {
    await incrementAnalytics(storeId, 'carts_created')
  }

  if (
    shouldDispatchCartRecovery({
      canSendWhatsApp,
      cartExists: Boolean(cart),
      cartStatus: cart?.status ?? null,
      created,
    })
  ) {
    await dispatchWhatsAppRecovery({
      storeId,
      cartId: recoveryCartId,
      payload,
      customer,
      cartValue,
      items,
      cartToken: token,
      persistMessageRow: Boolean(cart?.id),
    })
  }
}

// ============================================
// Handle checkout create/update
// ============================================
async function handleCheckoutWebhook(storeId: string, payload: any) {
  const token = normalizeCheckoutToken(payload)
  const customer = (payload.customer || {}) as Record<string, unknown>

  if (!token) {
    console.error('Failed to insert abandoned checkout: missing checkout token', {
      message: 'payload.token / payload.id missing',
      code: 'MISSING_TOKEN',
    })
    return
  }

  const customerPhone = extractCustomerPhone(payload, customer)
  const customerEmail = extractCustomerEmail(payload, customer)
  const customerName = extractCustomerName(customer, payload)
  const items = normalizeLineItems(payload)
  const cartValue = sumCartValue(items)
  const checkoutUrl =
    (typeof payload.abandoned_checkout_url === 'string' && payload.abandoned_checkout_url) ||
    null

  const previousPhone = (
    await supabaseAdmin
      .from('abandoned_carts')
      .select('customer_phone')
      .eq('store_id', storeId)
      .eq('shopify_cart_token', token)
      .maybeSingle()
  ).data?.customer_phone as string | null | undefined

  const { cart, error, created } = await upsertAbandonedCartRecord({
    storeId,
    token,
    customerPhone,
    customerEmail,
    customerName,
    cartValue,
    items,
    checkoutUrl,
  })

  if (error) {
    logSupabaseError('Failed to insert abandoned checkout', error)
  } else {
    console.log('✅ Abandoned checkout upserted', {
      cartId: cart?.id ?? null,
      token,
      created,
      status: cart?.status ?? null,
      phone: customerPhone ?? cart?.customer_phone ?? null,
    })
  }

  if (created && cart?.id) {
    await incrementAnalytics(storeId, 'carts_created')
  }

  const recoveryCartId = cart?.id || token
  const phoneJustArrived = Boolean(customerPhone && !previousPhone)
  const shouldDispatch =
    Boolean(customerPhone && (checkoutUrl || cart?.id)) &&
    (!cart || cart.status === 'pending') &&
    (created || phoneJustArrived || !previousPhone)

  if (shouldDispatch) {
    console.log(
      `📲 Dispatching WhatsApp recovery for checkout ${recoveryCartId} (created=${created}, phoneJustArrived=${phoneJustArrived})`
    )
    await dispatchWhatsAppRecovery({
      storeId,
      cartId: recoveryCartId,
      payload,
      customer,
      cartValue,
      items,
      cartToken: token,
      persistMessageRow: Boolean(cart?.id),
    })
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

  // Cap the scan: only the most recent open carts are realistic matches, and an
  // unbounded fetch on a busy store loads the whole table into memory.
  const { data: carts, error } = await supabaseAdmin
    .from('abandoned_carts')
    .select('id, cart_value, status, customer_phone, customer_email, created_at')
    .eq('store_id', storeId)
    .in('status', ['pending', 'messaged'])
    .order('created_at', { ascending: false })
    .limit(100)

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
  
  // Fetch only the counters we mutate (was select('*')); maybeSingle avoids a
  // thrown "0 rows" error on the first event of the day.
  const { data: existing } = await supabaseAdmin
    .from('analytics_daily')
    .select('id, carts_created, carts_recovered, revenue_recovered')
    .eq('store_id', storeId)
    .eq('date', today)
    .maybeSingle()
  
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

    // Clear token + mark billing cancelled (keep row for audit / reinstall)
    await supabaseAdmin
      .from('stores')
      .update({
        shopify_access_token: null,
        billing_status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', storeId)

    console.log(`Store uninstalled: ${shopDomain}, billing cleared`)
  } catch (err) {
    console.error('Error handling app uninstall for', shopDomain, err)
  }
}

// ============================================
// Handle app_subscriptions/update (Shopify Billing)
// ============================================
async function handleAppSubscriptionUpdate(
  storeId: string,
  shopDomain: string,
  payload: Record<string, unknown>
) {
  const adminGraphqlId =
    typeof payload.admin_graphql_api_id === 'string'
      ? payload.admin_graphql_api_id
      : null
  const rawStatus =
    typeof payload.status === 'string' ? payload.status : 'NONE'
  const name = typeof payload.name === 'string' ? payload.name : null
  const billingStatus = toDbBillingStatus(rawStatus)
  const planId = inferPlanIdFromSubscriptionName(name)

  const updates: Record<string, unknown> = {
    billing_status: billingStatus,
    updated_at: new Date().toISOString(),
  }

  if (adminGraphqlId) {
    updates.shopify_subscription_id = adminGraphqlId
  }
  if (planId) {
    updates.billing_plan = planId
  }

  // Trial / period end when Shopify includes them on the payload.
  const trialEndsOn =
    typeof payload.trial_ends_on === 'string' ? payload.trial_ends_on : null
  const currentPeriodEnd =
    typeof payload.current_period_end === 'string'
      ? payload.current_period_end
      : null
  if (trialEndsOn) updates.billing_trial_ends_at = trialEndsOn
  if (currentPeriodEnd) updates.billing_current_period_end = currentPeriodEnd

  const { error } = await supabaseAdmin
    .from('stores')
    .update(updates)
    .eq('id', storeId)

  if (error) {
    console.error(
      `[app_subscriptions/update] failed for ${shopDomain}:`,
      error
    )
    throw error
  }

  console.log(
    `✅ Billing status for ${shopDomain} → ${billingStatus}` +
      (planId ? ` (plan=${planId})` : '')
  )
}