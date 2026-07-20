import { NextRequest, NextResponse } from 'next/server'
import {
  buildAbandonedCartContentVariables,
  buildRecoveryWhatsAppBody,
  getTwilioAbandonedCartContentSid,
  hasTwilioWhatsAppCredentials,
  resolveRecoveryCustomerName,
  sendTwilioWhatsAppMessage,
} from '@/lib/services/twilio-whatsapp'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 1. Meta Webhook Verification (GET Method)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 })
      }
      return new NextResponse('Forbidden', { status: 403 })
    }
    return new NextResponse('Bad Request', { status: 400 })
  } catch (error: any) {
    console.error('❌ WhatsApp Webhook GET Verification Error:', error.message)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

// 2. Abandoned-cart Twilio WhatsApp send (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const phone = body.phone || body.phoneNumber
    const checkoutUrl = body.checkoutUrl || body.abandonedCartUrl
    const customerName = resolveRecoveryCustomerName(body.customerName)
    const cartValue = Number(body.cartTotalAmount ?? body.cartValue ?? 0) || 0

    if (!phone || !checkoutUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing required tracking parameters (phone/phoneNumber, checkoutUrl/abandonedCartUrl)',
        },
        { status: 400 }
      )
    }

    if (!hasTwilioWhatsAppCredentials()) {
      console.error('❌ Twilio Credentials Missing in Environment Configurations.')
      return NextResponse.json(
        {
          success: false,
          error: 'Core Twilio authentication credentials missing inside cloud variables',
        },
        { status: 500 }
      )
    }

    const contentSid = getTwilioAbandonedCartContentSid()
    const contentVariables = buildAbandonedCartContentVariables({
      customerName,
      checkoutUrl,
    })
    const messageBody = buildRecoveryWhatsAppBody({
      customerName,
      cartValue,
      recoveryLink: checkoutUrl,
    })

    console.log('📤 /api/whatsapp/send abandoned-cart payload', {
      to: phone,
      customerName,
      checkoutUrl,
      contentSid: contentSid || null,
      contentVariables,
    })

    const sendResult = contentSid
      ? await sendTwilioWhatsAppMessage(phone, { contentSid, contentVariables })
      : await sendTwilioWhatsAppMessage(phone, { body: messageBody })

    if (!sendResult.success) {
      console.error('❌ Twilio abandoned-cart send failed:', sendResult)
      return NextResponse.json(
        {
          success: false,
          error: sendResult.error || 'Twilio gateway rejected execution request',
          contentSid: sendResult.contentSid ?? contentSid ?? null,
        },
        { status: 502 }
      )
    }

    console.log('✅ Abandoned-cart WhatsApp dispatched', {
      to: sendResult.to ?? phone,
      messageSid: sendResult.messageSid,
      status: sendResult.status,
      contentSid: sendResult.contentSid ?? contentSid ?? null,
    })

    return NextResponse.json({
      success: true,
      message: 'Abandoned cart WhatsApp recovery message sent',
      messageSid: sendResult.messageSid,
      deliveryStatus: sendResult.status,
      contentSid: sendResult.contentSid ?? contentSid ?? null,
    })
  } catch (error: any) {
    console.error('❌ Send WhatsApp API Route Node Collision Error:', error.message)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal network delivery pipe exception',
      },
      { status: 500 }
    )
  }
}
