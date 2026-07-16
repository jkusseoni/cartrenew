import { NextRequest, NextResponse } from "next/server";

import { loadShopifyStoreDashboard } from "@/lib/shopify/dashboard";
import { isValidShopDomain } from "@/lib/shopify/config";
import {
  getBearerToken,
  verifyShopifySessionToken,
} from "@/lib/shopify/session-token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = getBearerToken(request.headers.get("authorization"));
  const isDev = process.env.NODE_ENV !== "production";

  let shop: string | null = null;

  if (token) {
    const verified = verifyShopifySessionToken(token);
    if (!verified) {
      return NextResponse.json({ error: "Invalid session token" }, { status: 401 });
    }
    shop = verified.shop;
  } else if (isDev) {
    const devShop = request.nextUrl.searchParams.get("shop");
    if (isValidShopDomain(devShop)) {
      shop = devShop;
    }
  }

  if (!shop) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dashboard = await loadShopifyStoreDashboard(shop, {
    autoProvision: isDev,
  });

  return NextResponse.json({
    shop,
    store: dashboard.store,
    metrics: dashboard.metrics,
    carts: dashboard.carts,
  });
}
