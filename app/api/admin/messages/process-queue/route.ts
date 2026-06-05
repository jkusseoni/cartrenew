export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMessage } from '@/lib/services/provider'
import { getAuth } from '@clerk/nextjs/server'

const MAX_SEND_ATTEMPTS = 3

function getBackoffMinutes(attemptCount: number) {
  return Math.min(5 * 2 ** attemptCount, 60)
}

export async function POST(req: Request) {
  try {
    // Simple protection: allow Clerk-authenticated admin users OR a signed secret header.
    const adminSecret = process.env.ADMIN_PROCESS_SECRET
    const providedSecret = req.headers.get('x-admin-secret')
    const userId = process.env.NODE_ENV === 'development' ? 'dev-admin' : getAuth(req as any).userId

    if (!userId && (!adminSecret || providedSecret !== adminSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const nowISO = new Date().toISOString()
    let messagesResponse = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('status', 'pending')
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowISO}`)
      .order('created_at', { ascending: true })
      .limit(50)

    if (messagesResponse.error && messagesResponse.error.message?.includes('next_retry_at')) {
      messagesResponse = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50)
    }

    const messages = messagesResponse.data
    const error = messagesResponse.error

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
        await supabaseAdmin.from('messages').update({ status: 'queued' }).eq('id', m.id)

        const payload = {
          id: m.id,
          to: m.phone,
          body: m.body || m.template_name || '',
        }

        const res = await sendMessage(payload)
        const nextAttempt = (m.attempt_count ?? 0) + 1

        if (res.success) {
          await supabaseAdmin
            .from('messages')
            .update({
              status: 'sent',
              whatsapp_message_id: res.providerId || null,
              error_message: null,
              sent_at: new Date().toISOString(),
              attempt_count: nextAttempt,
              next_retry_at: null,
            })
            .eq('id', m.id)
          results.push({ id: m.id, success: true })
        } else if (nextAttempt >= MAX_SEND_ATTEMPTS) {
          await supabaseAdmin
            .from('messages')
            .update({
              status: 'failed',
              error_message: res.error || 'unknown',
              attempt_count: nextAttempt,
              next_retry_at: null,
            })
            .eq('id', m.id)
          results.push({ id: m.id, success: false, error: res.error })
        } else {
          const backoffMinutes = getBackoffMinutes(m.attempt_count ?? 0)
          await supabaseAdmin
            .from('messages')
            .update({
              status: 'pending',
              error_message: res.error || 'unknown',
              attempt_count: nextAttempt,
              next_retry_at: new Date(Date.now() + backoffMinutes * 60000).toISOString(),
            })
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
