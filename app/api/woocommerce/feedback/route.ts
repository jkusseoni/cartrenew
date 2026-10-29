// app/api/woocommerce/feedback/route.ts
//
// Receives the optional deactivation survey from the "CartRenew for WooCommerce"
// plugin (includes/class-cr-feedback.php). The plugin only calls this after the
// merchant picks a reason and clicks "Submit & Deactivate". No auth, no PII:
// reason, short comment and version strings only.

import { NextRequest, NextResponse } from 'next/server'
import { brand } from '@/lib/brand'
import { legacyCommerceRouteEnabled } from '@/lib/privacy/legacy-commerce'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const REASONS = new Set([
  'setup',
  'not_working',
  'features',
  'better_plugin',
  'temporary',
  'other',
])

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

export async function POST(req: NextRequest) {
  if (!legacyCommerceRouteEnabled(brand.isDefault)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const reason = typeof body.reason === 'string' ? body.reason : ''
  if (!REASONS.has(reason)) {
    return NextResponse.json({ error: 'Unknown reason.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('woocommerce_plugin_feedback').insert({
    reason,
    comment: clip(body.comment, 500),
    plugin_version: clip(body.plugin_version, 20),
    wp_version: clip(body.wp_version, 20),
    wc_version: clip(body.wc_version, 20),
    connected: body.connected === true,
  })

  if (error) {
    console.error('CartRenew WooCommerce: failed to store feedback', error)
    return NextResponse.json({ error: 'Failed to store feedback.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
