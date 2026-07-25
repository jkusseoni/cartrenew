import { NextRequest, NextResponse } from "next/server";

import { loadShopifyStoreDashboard } from "@/lib/shopify/dashboard";
import { findOrCreateMerchantByShopDomain } from "@/lib/shopify/merchant";
import { isValidShopDomain } from "@/lib/shopify/config";
import {
  getBearerToken,
  verifySessionToken,
} from "@/lib/shopify/verifySessionToken";

export const dynamic = "force-dynamic";

/**
 * GET /api/app/dashboard
 * Auth: Shopify session token (Authorization: Bearer <idToken>).
 * Tenant key: shop domain from JWT `dest` (not Clerk user id).
 */
export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const token = getBearerToken(request.headers.get("authorization"));

  try {
    let shop: string;

    if (token) {
      const { shop: tokenShop } = await verifySessionToken(token);
      shop = tokenShop;
    } else if (isDev) {
      const devShop = request.nextUrl.searchParams.get("shop");
      if (!isValidShopDomain(devShop)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      shop = devShop;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let merchantId: string | undefined;
    try {
      const merchant = await findOrCreateMerchantByShopDomain(shop);
      merchantId = merchant.id;
    } catch (prismaError) {
      console.warn("[api/app/dashboard] merchant upsert skipped:", prismaError);
    }

    const dashboard = await loadShopifyStoreDashboard(shop, {
      autoProvision: isDev,
    });

    if (!dashboard.store && !isDev) {
      return NextResponse.json(
        {
          shop,
          merchantId,
          needsInstall: true,
          store: null,
          metrics: dashboard.metrics,
          carts: [],
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      shop,
      merchantId,
      store: dashboard.store,
      metrics: dashboard.metrics,
      carts: dashboard.carts,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
