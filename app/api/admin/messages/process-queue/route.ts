export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { processDueRetries } from '@/lib/services/recovery-dispatch'
import { hasWhatsAppCredentials } from '@/lib/services/whatsapp-meta'

/**
 * Manual trigger for the WhatsApp retry worker. The same worker runs on the
 * /api/cart-recovery cron; this route only exists for admins to drain the
 * queue on demand.
 */
export async function POST(req: Request) {
  try {
    // Simple protection: allow Clerk-authenticated admin users OR a signed secret header.
    const adminSecret = process.env.ADMIN_PROCESS_SECRET
    const providedSecret = req.headers.get('x-admin-secret')
    const userId = process.env.NODE_ENV === 'development' ? 'dev-admin' : getAuth(req as any).userId

    if (!userId && (!adminSecret || providedSecret !== adminSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasWhatsAppCredentials()) {
      return NextResponse.json({ error: 'WhatsApp credentials missing or placeholder' }, { status: 500 })
    }

    const { expired, results } = await processDueRetries({ limit: 50 })
    const successes = results.filter((r) => r.outcome === 'sent').length

    return NextResponse.json({
      processed: results.length,
      expired,
      successes,
      failures: results.length - successes,
      results,
    })
  } catch (err: any) {
    console.error('Queue processing error:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
