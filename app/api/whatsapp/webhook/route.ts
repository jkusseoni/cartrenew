import { NextRequest, NextResponse } from 'next/server';
import { applyStatusEvent } from '@/lib/services/whatsapp-status-sync';
import { extractStatusEvents, verifyMetaSignature } from '@/lib/whatsapp-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 1. मेटा वेबहुक वेरिफिकेशन (GET)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
      }
      return new NextResponse('Forbidden', { status: 403 });
    }
    return new NextResponse('Bad Request', { status: 400 });
  } catch (error: any) {
    console.error("❌ WhatsApp Webhook GET Error:", error.message);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

/**
 * 2. Meta delivery-status events (POST). Signed with X-Hub-Signature-256
 * using the Meta app secret. Non-status events (incoming messages etc.) are
 * acknowledged and ignored. Returns 500 only on DB errors so Meta retries;
 * applying an event twice is a no-op.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const appSecret = (process.env.WHATSAPP_APP_SECRET ?? '').trim();

  if (!appSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ WHATSAPP_APP_SECRET is not configured — rejecting WhatsApp webhook');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
  } else if (!verifyMetaSignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
    console.warn('⚠️ WhatsApp webhook rejected: invalid X-Hub-Signature-256');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const events = extractStatusEvents(body);
  const counts = { updated: 0, no_change: 0, unknown_message: 0, errors: 0 };

  for (const event of events) {
    try {
      counts[await applyStatusEvent(event)] += 1;
    } catch (error) {
      counts.errors += 1;
      console.error('❌ WhatsApp status apply failed', {
        whatsappMessageId: event.whatsappMessageId,
        status: event.status,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (events.length) {
    console.log('📬 WhatsApp status webhook processed', { statuses: events.length, ...counts });
  }

  if (counts.errors > 0) {
    return NextResponse.json({ success: false, ...counts }, { status: 500 });
  }
  return NextResponse.json({ success: true, statuses: events.length, ...counts }, { status: 200 });
}
