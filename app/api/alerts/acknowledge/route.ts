import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await req.json()
  const id = body?.id
  if (!id) {
    return NextResponse.json({ error: 'Missing alert id' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('alerts')
    .update({ acknowledged: true })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
