export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
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

    return NextResponse.json({ messages: data || [] })
  } catch (err) {
    console.error('Admin pending messages GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
