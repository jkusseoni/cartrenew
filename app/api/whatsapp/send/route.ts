import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 1. Meta Webhook Verification (GET Method)
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
    console.error("❌ WhatsApp Webhook GET Verification Error:", error.message);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// 2. Upgraded Twilio Engine Trigger Handler (POST Method)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // ✅ Fix 1: Fallback mapping to absolute params matching both Poller & Webhooks casing
    const phone = body.phone || body.phoneNumber;
    const customerName = body.customerName || "Customer";
    const checkoutUrl = body.checkoutUrl || body.abandonedCartUrl;

    // Standard Strict Check Validation
    if (!phone || !checkoutUrl) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing required tracking parameters (phone/phoneNumber, checkoutUrl/abandonedCartUrl)" 
      }, { status: 400 });
    }

    // 2. Twilio Account Context Validation
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      console.error("❌ Twilio Credentials Missing in Environment Configurations.");
      return NextResponse.json({ 
        success: false, 
        error: "Core Twilio authentication credentials missing inside cloud variables" 
      }, { status: 500 });
    }

    // 3. Format phone string structure strictly to match Twilio payload nodes (whatsapp:+91...)
    let formattedTo = phone.trim();
    if (!formattedTo.startsWith('whatsapp:')) {
      const cleanPhone = formattedTo.startsWith('+') ? formattedTo : `+${formattedTo}`;
      formattedTo = `whatsapp:${cleanPhone}`;
    }

    // 4. Construct personalized text pattern template matching sandbox criteria
    const messageBody = `Hey ${customerName}, we noticed you left some great items in your cart. No worries, we've saved them for you! Complete your order instantly here to claim priority dispatch: ${checkoutUrl}`;

    // 5. Raw Basic-Auth Request compilation process
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

    const result = await response.json().catch(() => ({} as Record<string, unknown>));

    if (!response.ok) {
      // Print detailed API diagnostic dump straight to console dashboard
      console.error("❌ Twilio Gateway Rejection Object:", JSON.stringify(result));
      return NextResponse.json(
        {
          success: false,
          error: (result as { message?: string }).message || "Twilio gateway rejected execution request",
          code: (result as { code?: number }).code
        },
        { status: 502 }
      );
    }

    console.log(`✅ Recovery notification successfully dispatched node to: ${formattedTo}`);
    
    return NextResponse.json({
      success: true,
      message: "WhatsApp communication node initialized smoothly",
      messageSid: result.sid,
      deliveryStatus: result.status
    });

  } catch (error: any) {
    console.error("❌ Send WhatsApp API Route Node Collision Error:", error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Internal network delivery pipe exception" 
    }, { status: 500 });
  }
}