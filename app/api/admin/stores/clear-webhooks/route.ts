export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin, safeParseBody } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    // Admin-only: destructive store mutation.
    const unauthorized = await requireAdmin(req)
    if (unauthorized) return unauthorized

    const body = await safeParseBody<{ storeId?: string }>(req)
    const storeId = body?.storeId

    if (!storeId || typeof storeId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid storeId' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('stores')
      .update({ webhook_ids: [] })
      .eq('id', storeId)

    if (error) {
      console.error('Failed to clear webhook_ids for store', storeId, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Clear store webhook ids error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
