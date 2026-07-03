import { NextRequest } from 'next/server'

import { hasShopifyClientSecret, verifyWebhookHmac } from '@/lib/shopify/config'

function resolveTopic(req: NextRequest, topic?: string): string {
  if (topic) return topic

  const headerTopic = req.headers.get('x-shopify-topic')
  if (headerTopic) return headerTopic

  const marker = '/api/webhooks/'
  const pathname = req.nextUrl.pathname
  const idx = pathname.indexOf(marker)
  if (idx !== -1) {
    const suffix = pathname.slice(idx + marker.length).replace(/\/$/, '')
    if (suffix) return suffix
  }

  return 'unknown'
}

/**
 * Mandatory GDPR/compliance webhooks. Validates `X-Shopify-Hmac-SHA256` against
 * the raw body using SHOPIFY_API_SECRET (via getShopifyClientSecret).
 */
export async function handleShopifyComplianceWebhook(
  req: NextRequest,
  topic?: string
): Promise<Response> {
  const hmac = req.headers.get('x-shopify-hmac-sha256')
  const shopDomain = req.headers.get('x-shopify-shop-domain') || 'unknown'
  const resolvedTopic = resolveTopic(req, topic)
  const rawBody = await req.text()

  if (!hasShopifyClientSecret()) {
    console.error(
      `[compliance-webhook] ${resolvedTopic} rejected: SHOPIFY_CLIENT_SECRET / SHOPIFY_API_SECRET is not configured`
    )
    return new Response('Webhook secret not configured', { status: 500 })
  }

  if (!verifyWebhookHmac(rawBody, hmac)) {
    console.error(
      `[compliance-webhook] ${resolvedTopic} HMAC verification failed for ${shopDomain} at ${req.nextUrl.pathname}`
    )
    return new Response('Unauthorized', { status: 401 })
  }

  console.info(`[compliance-webhook] ${resolvedTopic} acknowledged for ${shopDomain}`)

  return new Response(null, { status: 200 })
}

export async function POST(req: NextRequest) {
  return handleShopifyComplianceWebhook(req)
}
