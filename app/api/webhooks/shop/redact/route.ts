export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest } from 'next/server'

import { handleShopifyComplianceWebhook } from '@/lib/shopify/compliance-webhook'

export async function POST(req: NextRequest) {
  return handleShopifyComplianceWebhook(req, 'shop/redact')
}
