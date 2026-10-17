export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { recordAccessAudit } from '@/lib/privacy/access-audit'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    // Admin-only: response contains customer phone numbers.
    const unauthorized = await requireAdmin(req)
    if (unauthorized) return unauthorized

    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('id, cart_id, store_id, phone, template_name, status, attempt_count, next_retry_at, error_message, created_at, store:stores(id, shopify_domain)')
      .in('status', ['pending', 'queued'])
      .order('next_retry_at', { ascending: true })
      .limit(100)

    if (error) {
      console.error('Failed to fetch pending messages for admin:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const messages = data || []
    const shops = new Set<string>()
    for (const row of messages) {
      const store = (row as { store?: { shopify_domain?: string } | null }).store
      const domain = store?.shopify_domain?.trim()
      if (domain) shops.add(domain.toLowerCase())
    }
    await recordAccessAudit({
      shop: shops.size === 1 ? [...shops][0] : shops.size > 1 ? `${shops.size}_shops` : null,
      action: 'read_admin',
      actor: 'GET /api/admin/messages/pending',
      count: messages.length,
    })

    return NextResponse.json({ messages })
  } catch (err) {
    console.error('Admin pending messages GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
