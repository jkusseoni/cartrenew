export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin, safeParseBody } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    const unauthorized = await requireAdmin(req)
    if (unauthorized) return unauthorized

    // safeParseBody: malformed JSON returns null instead of throwing a 500.
    const body = await safeParseBody<{ id?: string }>(req)
    const id = body?.id
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid alert id' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('alerts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Alert delete failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Alert delete route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
