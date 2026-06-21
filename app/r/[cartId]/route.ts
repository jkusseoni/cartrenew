export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

import {
  isRecoveryCartUuid,
  isValidRecoveryCartSlug,
} from '@/lib/recovery-link'
import { supabaseAdmin } from '@/lib/supabase'

const CART_SELECT =
  'id, store_id, checkout_url, status, shopify_cart_token, customer_email'

type AbandonedCartRow = {
  id: string
  store_id: string
  checkout_url: string | null
  status: string
  shopify_cart_token: string
  customer_email: string | null
}

async function findAbandonedCart(cartId: string): Promise<AbandonedCartRow | null> {
  const key = cartId.trim()

  if (isRecoveryCartUuid(key)) {
    const { data, error } = await supabaseAdmin
      .from('abandoned_carts')
      .select(CART_SELECT)
      .eq('id', key)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (data) {
      return data
    }
  }

  const { data, error } = await supabaseAdmin
    .from('abandoned_carts')
    .select(CART_SELECT)
    .eq('shopify_cart_token', key)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cartId: string }> }
) {
  const { cartId } = await params

  if (!isValidRecoveryCartSlug(cartId)) {
    return NextResponse.json({ error: 'Invalid cart id' }, { status: 400 })
  }

  let cart: AbandonedCartRow | null

  try {
    cart = await findAbandonedCart(cartId)
  } catch (error) {
    console.error('Recovery redirect lookup failed:', error)
    return NextResponse.json({ error: 'Failed to resolve cart' }, { status: 500 })
  }

  if (!cart) {
    console.warn('Recovery redirect: cart not found', { cartId })
    return NextResponse.json(
      {
        error: 'Cart not found',
        cartId,
        hint: 'Use abandoned_carts.id (UUID) or shopify_cart_token from Supabase',
      },
      { status: 404 }
    )
  }

  const checkoutUrl = cart.checkout_url?.trim()
  if (!checkoutUrl) {
    return NextResponse.json(
      {
        error: 'Checkout URL not available for this cart',
        cartId: cart.id,
        shopifyCartToken: cart.shopify_cart_token,
      },
      { status: 410 }
    )
  }

  try {
    new URL(checkoutUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid checkout URL on record' }, { status: 500 })
  }

  console.log('Recovery link clicked:', {
    cartId: cart.id,
    storeId: cart.store_id,
    status: cart.status,
    shopifyCartToken: cart.shopify_cart_token,
    customerEmail: cart.customer_email,
    checkoutUrl,
    referrer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.redirect(checkoutUrl, 302)
}
