import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_APP_API_KEY || ''
const SHOPIFY_API_SECRET = process.env.SHOPIFY_APP_API_SECRET || ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10'

function verifyHmac(query: URLSearchParams): boolean {
  const hmac = query.get('hmac') || ''
  const params = new URLSearchParams(Array.from(query.entries()).filter(([k]) => k !== 'hmac' && k !== 'signature'))
  const message = params.toString()
  const generated = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(hmac))
}

import crypto from 'crypto'

async function registerWebhooks(shop: string, accessToken: string) {
  const topics = [
    'carts/create',
    'carts/update',
    'checkouts/create',
    'checkouts/update',
    'orders/create',
  ]

  const address = `${APP_URL.replace(/\/$/, '')}/api/webhooks/shopify`
  try {
    // Fetch existing webhooks for this shop
    const listRes = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    const existing = listRes.ok ? await listRes.json().then((j) => j.webhooks || []) : []

    const collected: Array<{ id: string | number; topic: string; address: string }> = []

    for (const topic of topics) {
      const match = existing.find((w: any) => w.topic === topic && String(w.address).replace(/\/$/, '') === address.replace(/\/$/, ''))
      if (match) {
        collected.push({ id: match.id, topic: match.topic, address: match.address })
        console.log(`Webhook for ${topic} already registered on ${shop}, skipping`)
        continue
      }

      // Create webhook if not present
      const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ webhook: { topic, address, format: 'json' } }),
      })

      if (!res.ok) {
        const body = await res.text()
        console.warn(`Failed to register webhook ${topic} for ${shop}: ${res.status} ${body}`)
      } else {
        const body = await res.json()
        const created = body.webhook
        collected.push({ id: created.id, topic: created.topic, address: created.address })
        console.log(`Registered webhook ${topic} for ${shop}`)
      }
    }

    return collected
  } catch (err) {
    console.error('Error registering webhooks for shop', shop, err)
    return []
  }
}

// OAuth callback: exchanges code for access token and registers webhooks
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const q = url.searchParams

    const shop = q.get('shop')
    const code = q.get('code')
    const state = q.get('state')

    if (!shop || !code) {
      return NextResponse.json({ error: 'Missing shop or code' }, { status: 400 })
    }

    // verify hmac
    if (!verifyHmac(q)) {
      return NextResponse.json({ error: 'HMAC validation failed' }, { status: 401 })
    }

    // Exchange code for access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: SHOPIFY_API_KEY, client_secret: SHOPIFY_API_SECRET, code }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error('Failed to exchange code for token', body)
      return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
    }

    const tokenJson = await tokenRes.json()
    const accessToken = tokenJson.access_token

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 500 })
    }

    // Save or update store and get its ID
    const clerkUserId = state || `webhook_${shop.replace(/[^a-z0-9]/gi, '_')}`

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

    if (upsertRes.error) {
      console.error('Failed to upsert store', upsertRes.error)
      return NextResponse.json({ error: 'Failed to save store' }, { status: 500 })
    }

    // Fetch store record to get id
    const { data: fetchedStore, error: fetchErr } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('shopify_domain', shop)
      .maybeSingle()

    if (fetchErr) {
      console.error('Failed to fetch store after upsert', fetchErr)
    }

    const storeId = fetchedStore?.id

    // Register webhooks for this shop and save webhook IDs to the store
    const registered = await registerWebhooks(shop, accessToken)

    if (storeId && registered && registered.length > 0) {
      await supabaseAdmin
        .from('stores')
        .update({ webhook_ids: registered })
        .eq('id', storeId)
    }

    // Redirect back to settings
    const redirectTo = `${APP_URL.replace(/\/$/, '')}/settings`
    return NextResponse.redirect(redirectTo)
  } catch (error) {
    console.error('Shopify OAuth callback error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
