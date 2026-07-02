export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    // Admin-only: exposes owner ids and WhatsApp phone ids.
    const unauthorized = await requireAdmin(req)
    if (unauthorized) return unauthorized

    const { data, error } = await supabaseAdmin
      .from('stores')
      .select('id, shopify_domain, webhook_ids, clerk_user_id, whatsapp_phone_id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('Failed to fetch stores for admin:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ stores: data || [] })
  } catch (err) {
    console.error('Admin stores GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
