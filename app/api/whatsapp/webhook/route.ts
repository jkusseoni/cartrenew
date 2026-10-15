import { NextRequest, NextResponse } from 'next/server';
import { brand } from '@/lib/brand';
import { recordWhatsAppOptOut } from '@/lib/services/whatsapp-opt-out';
import { applyStatusEvent } from '@/lib/services/whatsapp-status-sync';
import { extractOptOutSenders, summarizeInboundMessages } from '@/lib/whatsapp/opt-out';
import {
  forwardOptOutWebhook,
  OPT_OUT_FORWARDED_HEADER,
  optOutForwardDecision,
  runAfterResponse,
  WEBHOOK_LOG_PREFIX as LOG,
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
 *
 * Logs at each decision point carry no phone numbers, message text or body.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const appSecret = (process.env.WHATSAPP_APP_SECRET ?? '').trim();
  const signatureHeader = request.headers.get('x-hub-signature-256');
  const alreadyForwarded = request.headers.has(OPT_OUT_FORWARDED_HEADER);
  const source = `forwarded=${alreadyForwarded}`;

  if (!appSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`${LOG} rejected: secret not configured (WHATSAPP_APP_SECRET) ${source}`);
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    console.log(`${LOG} signature verified=false (no app secret, non-production) ${source}`);
  } else if (!verifyMetaSignature(rawBody, signatureHeader, appSecret)) {
    console.warn(`${LOG} signature verified=false ${source}`);
    console.warn(
      `${LOG} rejected: signature (header=${signatureHeader ? 'invalid' : 'missing'}) ${source}`
    );
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  } else {
    console.log(`${LOG} signature verified=true ${source}`);
  }
  // Without a secret (local dev only) the body is unsigned: never trusted for opt-outs.
  const signatureVerified = Boolean(appSecret);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.warn(`${LOG} rejected: invalid JSON`);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const inbound = summarizeInboundMessages(body);
  for (const message of inbound) {
    console.log(`${LOG} inbound message received (type=${message.type}, reply=${message.isReply})`);
  }
  if (inbound.length) {
    console.log(`${LOG} opt-out keyword detected=${inbound.some((m) => m.optOutKeyword)}`);
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
  if (!brand.isDefault) {
    const senders = extractOptOutSenders(body);
    if (senders.length && !signatureVerified) {
      console.warn(`${LOG} opt-out not recorded reason=signature_unverified`);
    } else if (inbound.some((m) => m.optOutKeyword) && !senders.length) {
      console.warn(`${LOG} opt-out not recorded reason=invalid_sender`);
    }
    for (const phone of signatureVerified ? senders : []) {
      try {
        await recordWhatsAppOptOut(phone);
        optOuts += 1;
        console.log(`${LOG} opt-out recorded`);
      } catch (error) {
        counts.errors += 1;
        console.error(
          `${LOG} opt-out not recorded error=${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
  const optOutCount = brand.isDefault ? {} : { opt_outs: optOuts };

  if (brand.isDefault) {
    const decision = optOutForwardDecision({
      isDefaultBrand: true,
      configuredUrl: process.env.PINGZA_WEBHOOK_FORWARD_URL,
      signatureVerified,
      signatureHeader,
      alreadyForwarded,
      body,
    });
    if (decision.forward && signatureHeader) {
      const { url } = decision;
      const via = runAfterResponse(() =>
        forwardOptOutWebhook({ url, rawBody, signature: signatureHeader })
      );
      console.log(`${LOG} forward scheduled via=${via}`);
    } else if (!decision.forward && inbound.length) {
      console.log(`${LOG} forward skipped reason=${decision.reason}`);
    }
  }

  if (counts.errors > 0) {
    return NextResponse.json({ success: false, ...counts, ...optOutCount }, { status: 500 });
  }
  return NextResponse.json(
    { success: true, statuses: events.length, ...counts, ...optOutCount },
    { status: 200 }
  );
}
