export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

import { brand } from '@/lib/brand'
import { whatsAppEngineStatus } from '@/lib/services/whatsapp-engine-status'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  let supabaseOk = false

  try {
    const { error } = await supabaseAdmin.from('stores').select('id').limit(1)
    supabaseOk = !error
  } catch {
    supabaseOk = false
  }

  const webhookBypass = process.env.SHOPIFY_WEBHOOK_BYPASS === 'true'
  const appUrlConfigured = Boolean(
    process.env.SHOPIFY_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim()
  )
  const shopifyWebhooksOk = appUrlConfigured || process.env.NODE_ENV === 'development'

  return NextResponse.json({
    supabase: {
      ok: supabaseOk,
      label: supabaseOk ? 'Connected' : 'Disconnected',
    },
    shopifyWebhooks: {
      ok: shopifyWebhooksOk,
      label: shopifyWebhooksOk ? 'Listening' : 'Offline',
      bypass: webhookBypass,
    },
    whatsApp: whatsAppEngineStatus(brand.isDefault),
    checkedAt: new Date().toISOString(),
  })
}
