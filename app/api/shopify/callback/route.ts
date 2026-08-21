export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

/**
 * The legacy callback did not bind OAuth state to the initiating browser.
 * Keep the route closed while stale Shopify configuration propagates.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "Legacy Shopify OAuth callback disabled",
      callback: "/api/auth/shopify/callback",
    },
    { status: 410 }
  );
}
