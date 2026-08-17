import { NextRequest, NextResponse } from 'next/server'
import {
  buildAbandonedCartTemplateVariables,
  resolveRecoveryCustomerName,
  sendWhatsAppMessage,
} from '@/lib/services/whatsapp-meta'

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

// 2. Abandoned-cart Meta WhatsApp send (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const phone = body.phone || body.phoneNumber
    const checkoutUrl = body.checkoutUrl || body.abandonedCartUrl
    const customerName = resolveRecoveryCustomerName(body.customerName)

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

    const bodyVariables = buildAbandonedCartTemplateVariables({
      customerName,
      checkoutUrl,
    })

    console.log('📤 /api/whatsapp/send abandoned-cart Meta template payload', {
      to: phone,
      customerName,
      checkoutUrl,
      templateName: 'abandoned_cart_reminder',
      bodyVariables,
    })

    const sendResult = await sendWhatsAppMessage(phone, {
      templateName: 'abandoned_cart_reminder',
      bodyVariables,
    })

    if (!sendResult.success) {
      console.error('❌ Meta WhatsApp abandoned-cart send failed:', sendResult)
      return NextResponse.json(
        {
          success: false,
          error: sendResult.error || 'Meta WhatsApp gateway rejected execution request',
        },
        { status: 502 }
      )
    }

    console.log('✅ Abandoned-cart Meta WhatsApp dispatched', {
      to: sendResult.to ?? phone,
      messageId: sendResult.messageId,
      status: sendResult.status,
      templateName: sendResult.templateName ?? 'abandoned_cart_reminder',
    })

    return NextResponse.json({
      success: true,
      message: 'Abandoned cart WhatsApp recovery message sent',
      messageId: sendResult.messageId,
      deliveryStatus: sendResult.status,
      templateName: sendResult.templateName ?? 'abandoned_cart_reminder',
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
