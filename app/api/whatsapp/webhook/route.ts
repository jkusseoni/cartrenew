import { NextRequest, NextResponse } from 'next/server';

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

// 2. भविष्य में मेटा से आने वाले इनकमिंग मैसेजेस/स्टेटस के लिए (POST)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("📩 WhatsApp Incoming Event:", JSON.stringify(body, null, 2));
    
    // यहाँ आपका इनकमिंग मैसेज या डिलीवरी स्टेटस रीड करने का लॉजिक आएगा

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("❌ WhatsApp Webhook POST Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}