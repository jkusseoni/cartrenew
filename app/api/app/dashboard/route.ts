import { NextRequest, NextResponse } from "next/server";

import { loadShopifyStoreDashboard } from "@/lib/shopify/dashboard";
import { findOrCreateMerchantByShopDomain } from "@/lib/shopify/merchant";
import { isValidShopDomain } from "@/lib/shopify/config";
import {
  getBearerToken,
  verifySessionToken,
} from "@/lib/shopify/verifySessionToken";

export const dynamic = "force-dynamic";

const EMPTY_METRICS = {
  trackedCarts: 0,
  recovered: 0,
  recoveredValue: 0,
};

/**
 * GET /api/app/dashboard
 * Auth: Shopify session token (Authorization: Bearer <idToken>).
 * Tenant key: shop domain from JWT `dest` (not Clerk user id).
 *
 * Must never 500 on an empty/new store — reviewers install on zero-data shops.
 * Auth failures → 401; data/load issues → 200 with empty carts + metrics.
 */
export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const token = getBearerToken(request.headers.get("authorization"));

  let shop: string;

  try {
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
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let merchantId: string | undefined;
  try {
    const merchant = await findOrCreateMerchantByShopDomain(shop);
    merchantId = merchant.id;
  } catch (prismaError) {
    console.warn("[api/app/dashboard] merchant upsert skipped:", prismaError);
  }

  try {
    const dashboard = await loadShopifyStoreDashboard(shop, {
      autoProvision: isDev,
    });

    const metrics = dashboard.metrics ?? EMPTY_METRICS;
    const carts = Array.isArray(dashboard.carts) ? dashboard.carts : [];

    if (!dashboard.store && !isDev) {
      return NextResponse.json(
        {
          shop,
          merchantId,
          needsInstall: true,
          store: null,
          metrics: EMPTY_METRICS,
          carts: [],
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      shop,
      merchantId,
      needsInstall: false,
      store: dashboard.store,
      metrics,
      carts,
    });
  } catch (loadError) {
    // Never surface a 500/HTML error page to the embedded iframe for empty stores.
    console.warn("[api/app/dashboard] load failed (returning empty state):", loadError);
    return NextResponse.json(
      {
        shop,
        merchantId,
        needsInstall: false,
        store: {
          id: merchantId ?? "pending",
          shopify_domain: shop,
        },
        metrics: EMPTY_METRICS,
        carts: [],
        degraded: true,
      },
      { status: 200 }
    );
  }
}
