import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMessage } from '@/lib/services/provider'
import { getAuth } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  try {
    // Simple protection: allow Clerk-authenticated admin users OR a signed secret header.
    const { userId } = getAuth(req as any)
    const adminSecret = process.env.ADMIN_PROCESS_SECRET
    const providedSecret = (req.headers.get && req.headers.get('x-admin-secret')) || null

    if (!userId && (!adminSecret || providedSecret !== adminSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // fetch a batch of pending messages (tune limit as needed)
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      console.error('Failed to load pending messages:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    const results: Array<{ id: string; success: boolean; error?: string | null }> = []

    for (const m of messages) {
      try {
        // mark as queued so concurrent runners don't re-process immediately
        await supabaseAdmin.from('messages').update({ status: 'queued' }).eq('id', m.id)

        const payload = {
          id: m.id,
          to: m.phone,
          body: m.body || m.template_name || '',
        }

        const res = await sendMessage(payload)

        if (res.success) {
          await supabaseAdmin
            .from('messages')
            .update({ status: 'sent', whatsapp_message_id: res.providerId || null, error_message: null, sent_at: new Date().toISOString() })
            .eq('id', m.id)
          results.push({ id: m.id, success: true })
        } else {
          await supabaseAdmin
            .from('messages')
            .update({ status: 'failed', error_message: res.error || 'unknown' })
            .eq('id', m.id)
          results.push({ id: m.id, success: false, error: res.error })
        }
      } catch (innerErr: any) {
        console.error('Processing message failed', m?.id, innerErr)
        try {
          await supabaseAdmin.from('messages').update({ status: 'failed', error_message: String(innerErr) }).eq('id', m.id)
        } catch (updateErr) {
          console.error('Failed to mark message failed for', m?.id, updateErr)
        }
        results.push({ id: m.id, success: false, error: String(innerErr) })
      }
    }

    const processed = results.length
    const successes = results.filter((r) => r.success).length
    const failures = processed - successes

    return NextResponse.json({ processed, successes, failures, results })
  } catch (err: any) {
    console.error('Queue processing error:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
