export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { brand } from "@/lib/brand";
import { supabaseAdmin } from "@/lib/supabase";
import { findOrCreateMerchantByShopDomain } from "@/lib/shopify/merchant";
import {
  createAppSubscription,
  isShopifyBillingPlanId,
  type ShopifyBillingPlanId,
} from "@/lib/shopify/billing";
import { getValidShopifyAccessToken } from "@/lib/shopify/access-token";
import { installShopifyStoreFromSessionToken } from "@/lib/shopify/token-exchange";
import {
  getBearerToken,
  verifySessionToken,
} from "@/lib/shopify/verifySessionToken";

type StoreIdRow = { id: string };

/**
 * POST /api/app/billing/subscribe
 *
 * Auth: Shopify session token. Shop tenant comes from JWT `dest`, not the body.
 * Body: { planId, host? }
 */
export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let shop: string;
    try {
      ({ shop } = await verifySessionToken(token));
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await findOrCreateMerchantByShopDomain(shop);
    } catch (prismaError) {
      console.warn("[api/app/billing/subscribe] merchant upsert skipped:", prismaError);
    }

    const body = (await req.json().catch(() => null)) as {
      planId?: string;
      host?: string;
      shop?: string;
    } | null;

    const planId = body?.planId?.trim();
    const host = body?.host?.trim();

    // Ignore body.shop if present — session token dest is the source of truth.
    if (body?.shop && body.shop !== shop) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!planId || !isShopifyBillingPlanId(planId)) {
      return NextResponse.json(
        { error: "Invalid planId. Use starter | growth | scale." },
        { status: 400 }
      );
    }

    const { data: store, error } = await supabaseAdmin
      .from("stores")
      .select("id")
      .eq("shopify_domain", shop)
      .maybeSingle();

    if (error) {
      console.error("[api/app/billing/subscribe] store lookup failed", error);
      return NextResponse.json({ error: "Store lookup failed" }, { status: 500 });
    }

    const row = store as StoreIdRow | null;
    let storeId = row?.id;
    let accessToken: string | undefined;

    if (storeId) {
      const stored = await getValidShopifyAccessToken(storeId);
      if (stored.ok) {
        accessToken = stored.accessToken;
      } else if (stored.reason === "busy" || stored.reason === "unavailable") {
        return NextResponse.json(
          { error: "Shopify is not reachable right now. Try again in a moment." },
          { status: 503 }
        );
      }
    }

    // Fresh install, reinstall, legacy non-expiring token or dead refresh token:
    // finish the managed install with this request's session token.
    if (!storeId || !accessToken) {
      const installed = await installShopifyStoreFromSessionToken(shop, token);
      if (!installed.ok) {
        console.error(
          "[api/app/billing/subscribe] install before billing failed:",
          shop,
          installed.error
        );
        return NextResponse.json(
          {
            error: `We couldn't finish connecting your store to ${brand.name}. Reload the app and try again.`,
          },
          { status: 503 }
        );
      }
      storeId = installed.storeId;
      accessToken = installed.accessToken;
    }

    const { confirmationUrl, subscriptionId } = await createAppSubscription({
      shop,
      accessToken,
      planId: planId as ShopifyBillingPlanId,
      host,
    });

    await supabaseAdmin
      .from("stores")
      .update({
        billing_plan: planId,
        billing_status: "pending",
        shopify_subscription_id: subscriptionId,
      })
      .eq("id", storeId);

    return NextResponse.json({
      confirmationUrl,
      subscriptionId,
      planId,
      shop,
    });
  } catch (error) {
    console.error(
      "[api/app/billing/subscribe] request failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "Billing subscribe failed" }, { status: 502 });
  }
}
