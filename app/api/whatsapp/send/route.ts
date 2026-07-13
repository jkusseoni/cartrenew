import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

import { getTrackedRecoveryUrl } from '@/lib/recovery-link'
import { triggerWhatsAppRecoveryForCart } from '@/lib/services/messaging'
import {
  formatWhatsAppAddress,
  hasTwilioWhatsAppCredentials,
  sendTwilioWhatsAppMessage,
} from '@/lib/services/twilio-whatsapp'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SendBody = {
  cartId?: unknown
  phone?: unknown
  phoneNumber?: unknown
  customerName?: unknown
  checkoutUrl?: unknown
  abandonedCartUrl?: unknown
  cartUrl?: unknown
  abandonCartUrl?: unknown
}

/**
 * GET — Meta WhatsApp webhook verification (hub.challenge handshake).
 * Prefer /api/whatsapp/webhook for new Meta app configs; kept here for
 * backwards compatibility with older callback URLs.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 })
      }
      return new NextResponse('Forbidden', { status: 403 })
    }
    return new NextResponse('Bad Request', { status: 400 })
  } catch (error: unknown) {
    console.error(
      '❌ WhatsApp Webhook GET Verification Error:',
      error instanceof Error ? error.message : error
    )
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

/**
 * POST /api/whatsapp/send
 *
 * Two supported shapes (dashboard + pollers historically used different keys):
 *  1. { cartId } — look up abandoned_carts and dispatch recovery (dashboard "Send WA")
 *  2. { phone|phoneNumber, customerName, checkoutUrl|abandonedCartUrl|cartUrl|abandonCartUrl }
 *     — direct Twilio send for scripts / pollers
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendBody
    const cartId = asNonEmptyString(body.cartId)

    if (cartId) {
      return sendForAbandonedCart(request, cartId)
    }

    return sendDirectMessage(body)
  } catch (error: unknown) {
    console.error(
      '❌ Send WhatsApp API Route Error:',
      error instanceof Error ? error.message : error
    )
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal network delivery pipe exception',
      },
      { status: 500 }
    )
  }
}

async function sendForAbandonedCart(request: NextRequest, cartId: string) {
  const userId = await resolveUserId()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: cart, error: cartError } = await supabaseAdmin
    .from('abandoned_carts')
    .select(
      `
      id,
      store_id,
      customer_phone,
      customer_email,
      customer_name,
      cart_value,
      items,
      checkout_url,
      shopify_cart_token,
      status,
      store:stores(id, clerk_user_id)
    `
    )
    .eq('id', cartId)
    .maybeSingle()

  if (cartError || !cart) {
    return NextResponse.json({ success: false, error: 'Cart not found' }, { status: 404 })
  }

  const store = normalizeStore(cart.store)
  if (!store) {
    return NextResponse.json({ success: false, error: 'Store not found for cart' }, { status: 404 })
  }

  const skipOwnershipCheck =
    process.env.NODE_ENV !== 'production' ||
    request.headers.get('x-admin-secret') === process.env.ADMIN_PROCESS_SECRET

  if (!skipOwnershipCheck && store.clerk_user_id !== userId && userId !== 'local-dev') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  if (cart.status !== 'pending') {
    return NextResponse.json(
      {
        success: false,
        error: `Cart is ${cart.status}, only pending carts can be messaged`,
      },
      { status: 409 }
    )
  }

  if (!cart.customer_phone) {
    return NextResponse.json({ success: false, error: 'No phone number' }, { status: 400 })
  }

  const result = await triggerWhatsAppRecoveryForCart({
    storeId: cart.store_id,
    cartId: cart.id,
    customerPhone: cart.customer_phone,
    customerName: cart.customer_name,
    checkoutUrl: cart.checkout_url || getTrackedRecoveryUrl(cart.id),
    cartValue: Number(cart.cart_value) || 0,
    items: Array.isArray(cart.items) ? cart.items : [],
    customerEmail: cart.customer_email,
    cartToken: cart.shopify_cart_token,
  })

  if (result.sent) {
    return NextResponse.json({
      success: true,
      message: 'WhatsApp recovery message sent',
      messageId: result.messageId,
      messageSid: result.messageId,
    })
  }

  if (result.queued) {
    return NextResponse.json(
      {
        success: false,
        queued: true,
        error: result.error || 'Message queued for retry after provider failure',
      },
      { status: 502 }
    )
  }

  return NextResponse.json(
    {
      success: false,
      error: result.error || 'Failed to send WhatsApp recovery message',
    },
    { status: 500 }
  )
}

async function sendDirectMessage(body: SendBody) {
  const phone = asNonEmptyString(body.phone) || asNonEmptyString(body.phoneNumber)
  const customerName = asNonEmptyString(body.customerName) || 'there'
  const checkoutUrl =
    asNonEmptyString(body.checkoutUrl) ||
    asNonEmptyString(body.abandonedCartUrl) ||
    asNonEmptyString(body.cartUrl) ||
    asNonEmptyString(body.abandonCartUrl)

  if (!phone || !checkoutUrl) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Missing required parameters. Provide cartId, or phone/phoneNumber + checkoutUrl (aliases: abandonedCartUrl, cartUrl, abandonCartUrl).',
      },
      { status: 400 }
    )
  }

  if (!hasTwilioWhatsAppCredentials()) {
    return NextResponse.json(
      {
        success: false,
        error: 'Twilio WhatsApp credentials missing or still placeholders',
      },
      { status: 500 }
    )
  }

  const messageBody = `Hey ${customerName}, we noticed you left some great items in your cart. No worries, we've saved them for you! Complete your order instantly here to claim priority dispatch: ${checkoutUrl}`

  const result = await sendTwilioWhatsAppMessage(phone, messageBody)

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error || 'Twilio gateway rejected the message delivery request',
        to: formatWhatsAppAddress(phone),
      },
      { status: 502 }
    )
  }

  return NextResponse.json({
    success: true,
    message: 'WhatsApp communication node initialized smoothly',
    messageSid: result.messageSid,
    deliveryStatus: 'queued',
  })
}

async function resolveUserId(): Promise<string | null> {
  // proxy.ts skips clerkMiddleware in local/dev — auth() can throw there.
  if (process.env.NODE_ENV !== 'production') {
    try {
      const session = await auth()
      return session.userId || 'local-dev'
    } catch {
      return 'local-dev'
    }
  }

  try {
    const session = await auth()
    return session.userId
  } catch (authError) {
    console.warn('[api/whatsapp/send] auth() unavailable:', authError)
    return null
  }
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeStore(
  store: unknown
): { id: string; clerk_user_id: string } | null {
  if (!store) return null
  if (Array.isArray(store)) {
    const first = store[0] as { id?: string; clerk_user_id?: string } | undefined
    if (first?.id && first.clerk_user_id) {
      return { id: first.id, clerk_user_id: first.clerk_user_id }
    }
    return null
  }
  const row = store as { id?: string; clerk_user_id?: string }
  if (row.id && row.clerk_user_id) {
    return { id: row.id, clerk_user_id: row.clerk_user_id }
  }
  return null
}
