import { NextRequest, NextResponse } from 'next/server';
import { brand } from '@/lib/brand';
import { maskPhone } from '@/lib/phone';
import { recordWhatsAppOptOut } from '@/lib/services/whatsapp-opt-out';
import { applyStatusEvent } from '@/lib/services/whatsapp-status-sync';
import { extractOptOutSenders } from '@/lib/whatsapp/opt-out';
import {
  forwardOptOutWebhook,
  OPT_OUT_FORWARDED_HEADER,
  optOutForwardTarget,
  runAfterResponse,
} from '@/lib/whatsapp/opt-out-forward';
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
  } catch (error) {
    console.error("❌ WhatsApp Webhook GET Error:", error instanceof Error ? error.message : error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

/**
 * 2. Meta delivery-status events (POST). Signed with X-Hub-Signature-256
 * using the Meta app secret. Pingza also records inbound STOP-style replies
 * as opt-outs (no reply is sent); other incoming messages are acknowledged
 * and ignored. CartRenew, which Meta calls for the shared number, forwards
 * opt-out payloads to Pingza after responding. Returns 500 only on DB errors
 * so Meta retries; applying an event twice is a no-op.
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
  // Without a secret (local dev only) the body is unsigned: never trusted for opt-outs.
  const signatureVerified = Boolean(appSecret);

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

  let optOuts = 0;
  if (!brand.isDefault && signatureVerified) {
    for (const phone of extractOptOutSenders(body)) {
      try {
        await recordWhatsAppOptOut(phone);
        optOuts += 1;
      } catch (error) {
        counts.errors += 1;
        console.error('❌ WhatsApp opt-out not recorded', {
          phone: maskPhone(phone),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  const optOutCount = brand.isDefault ? {} : { opt_outs: optOuts };

  const forwardTo = optOutForwardTarget({
    isDefaultBrand: brand.isDefault,
    configuredUrl: process.env.PINGZA_WEBHOOK_FORWARD_URL,
    signatureVerified,
    alreadyForwarded: request.headers.has(OPT_OUT_FORWARDED_HEADER),
    body,
  });
  const signature = request.headers.get('x-hub-signature-256');
  if (forwardTo && signature) {
    runAfterResponse(() => forwardOptOutWebhook({ url: forwardTo, rawBody, signature }));
  }

  if (counts.errors > 0) {
    return NextResponse.json({ success: false, ...counts, ...optOutCount }, { status: 500 });
  }
  return NextResponse.json(
    { success: true, statuses: events.length, ...counts, ...optOutCount },
    { status: 200 }
  );
}
