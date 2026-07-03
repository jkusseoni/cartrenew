import { NextRequest, NextResponse } from 'next/server'

import { hasShopifyClientSecret, verifyWebhookHmac } from '@/lib/shopify/config'

/**
 * Handler for Shopify mandatory GDPR/compliance webhooks:
 *   - customers/data_request
 *   - customers/redact
 *   - shop/redact
 *
 * Validates `X-Shopify-Hmac-SHA256` against the raw body using
 * SHOPIFY_API_SECRET (via getShopifyClientSecret), returns 401 when invalid,
 * and 200 with an empty JSON body when valid so automated compliance checks pass.
 */
export async function handleShopifyComplianceWebhook(
  req: NextRequest,
  topic: string
): Promise<NextResponse> {
  const hmac = req.headers.get('x-shopify-hmac-sha256')
  const shopDomain = req.headers.get('x-shopify-shop-domain') || 'unknown'
  const rawBody = await req.text()

  if (!hasShopifyClientSecret()) {
    console.error(
      `[compliance-webhook] ${topic} rejected: SHOPIFY_CLIENT_SECRET / SHOPIFY_API_SECRET is not configured`
    )
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  if (!verifyWebhookHmac(rawBody, hmac)) {
    console.error(
      `[compliance-webhook] ${topic} HMAC verification failed for ${shopDomain} at ${req.nextUrl.pathname}`
    )
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  console.info(`[compliance-webhook] ${topic} acknowledged for ${shopDomain}`)

  return NextResponse.json({}, { status: 200 })
}
