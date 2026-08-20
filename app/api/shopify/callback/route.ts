export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy OAuth callback.
 *
 * No in-repo flow targets this endpoint. It previously accepted caller-controlled
 * state without a cookie binding, allowing a victim shop to be attached to an
 * attacker's Clerk identity. Keep the route closed while old Shopify app
 * configurations age out.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { error: "Legacy Shopify OAuth callback is disabled" },
    { status: 410 }
  );
}
