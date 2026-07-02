import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    // 1. Parse request body metrics incoming from client dashboard or automated hooks
    const body = await request.json();
    const { phone, customerName, checkoutUrl } = body;

    // Standard Validation Check
    if (!phone || !customerName || !checkoutUrl) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing required tracking parameters (phone, customerName, checkoutUrl)" 
      }, { status: 400 });
    }

    // 2. Fetch Twilio environment variables from secure local storage
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      return NextResponse.json({ 
        success: false, 
        error: "Core Twilio authentication credentials missing inside secure logs" 
      }, { status: 500 });
    }

    // 3. Format phone string to strict Twilio WhatsApp Sandbox/Prod standards (whatsapp:+91...)
    let formattedTo = phone.trim();
    if (!formattedTo.startsWith('whatsapp:')) {
      // Ensure plus symbol mapping exists
      const cleanPhone = formattedTo.startsWith('+') ? formattedTo : `+${formattedTo}`;
      formattedTo = `whatsapp:${cleanPhone}`;
    }

    // 4. Construct high-converting localized marketing recovery body template
    const messageBody = `Hey ${customerName}, we noticed you left some great items in your cart. No worries, we've saved them for you! Complete your order instantly here to claim priority dispatch: ${checkoutUrl}`;

    // 5. Raw Fetch Request Pipeline to Twilio API Infrastructure nodes
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const base64Auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${base64Auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromWhatsApp,
        To: formattedTo,
        Body: messageBody,
      }),
    });

    // Twilio can return non-JSON bodies on gateway errors — parse defensively.
    const result = await response.json().catch(() => ({} as Record<string, unknown>));

    if (!response.ok) {
      // 502: the upstream provider failed, not our server.
      return NextResponse.json(
        {
          success: false,
          error: (result as { message?: string }).message || "Twilio gateway rejected the message delivery request",
        },
        { status: 502 }
      );
    }

    // 6. Return successful dispatch message log logs
    return NextResponse.json({
      success: true,
      message: "WhatsApp communication node initialized smoothly",
      messageSid: result.sid,
      deliveryStatus: result.status
    });

  } catch (error: any) {
    console.error("❌ Send WhatsApp API Route Node Collision:", error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Internal network delivery pipe exception" 
    }, { status: 500 });
  }
}