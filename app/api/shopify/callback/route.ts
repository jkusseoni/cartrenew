export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getShopifyAppUrl,
  getShopifyClientId,
  getShopifyClientSecret,
  isValidShopDomain,
  verifyOAuthHmac,
} from '@/lib/shopify/config'
import { registerShopifyWebhooks } from '@/lib/shopify/webhooks'

// OAuth callback: exchanges code for access token and registers webhooks
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const q = url.searchParams

    const shop = q.get('shop')
    const code = q.get('code')
    const state = q.get('state')

    if (!isValidShopDomain(shop) || !code) {
      return NextResponse.json({ error: 'Missing or invalid shop/code' }, { status: 400 })
    }

    // verify hmac
    if (!verifyOAuthHmac(q)) {
      return NextResponse.json({ error: 'HMAC validation failed' }, { status: 401 })
    }

    // Exchange code for access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: getShopifyClientId(),
        client_secret: getShopifyClientSecret(),
        code,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error('Failed to exchange code for token', body)
      return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
    }

    // Defensive parse: a non-JSON body from Shopify should surface as a 502, not a 500.
    const tokenJson = await tokenRes.json().catch(() => null)
    const accessToken = tokenJson?.access_token

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 502 })
    }

    // Save or update store and get its ID
    const clerkUserId = state || `webhook_${shop.replace(/[^a-z0-9]/gi, '_')}`

    // Single round-trip: upsert and return the row id in one query
    // (previously an upsert followed by a separate select).
    const upsertRes = await supabaseAdmin
      .from('stores')
      .upsert(
        {
          shopify_domain: shop,
          shopify_access_token: accessToken,
          clerk_user_id: clerkUserId,
        },
        { onConflict: 'shopify_domain' }
      )
      .select('id')
      .maybeSingle()

    if (upsertRes.error) {
      console.error('Failed to upsert store', upsertRes.error)
      return NextResponse.json({ error: 'Failed to save store' }, { status: 500 })
    }

    const storeId = upsertRes.data?.id

    // Register webhooks for this shop and save webhook IDs to the store
    const registered = await registerShopifyWebhooks(shop, accessToken)

    if (storeId && registered && registered.length > 0) {
      await supabaseAdmin
        .from('stores')
        .update({ webhook_ids: registered })
        .eq('id', storeId)
    }

    // Redirect back to settings
    const redirectTo = `${getShopifyAppUrl()}/settings`
    return NextResponse.redirect(redirectTo)
  } catch (error) {
    console.error('Shopify OAuth callback error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
