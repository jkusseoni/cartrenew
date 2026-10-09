export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { installShopifyStoreFromSessionToken } from "@/lib/shopify/token-exchange";
import {
  getBearerToken,
  verifySessionToken,
} from "@/lib/shopify/verifySessionToken";

/**
 * POST /api/auth/token-exchange
 *
 * Managed install: exchange App Bridge session token (idToken) for an offline
 * access token. No redirects — safe to call from the embedded iframe.
 * Returns JSON only (never HTML) so the client can recover without an error page.
 */
export async function POST(req: NextRequest) {
  try {
    const sessionToken = getBearerToken(req.headers.get("authorization"));
    if (!sessionToken) {
      return NextResponse.json(
        { ok: false, error: "Missing Authorization Bearer session token" },
        { status: 401 }
      );
    }

    let shop: string;
    try {
      ({ shop } = await verifySessionToken(sessionToken));
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid session token" },
        { status: 401 }
      );
    }

    const result = await installShopifyStoreFromSessionToken(shop, sessionToken);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ ok: true, shop, storeId: result.storeId });
  } catch (error) {
    console.error("[token-exchange] unexpected error", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
