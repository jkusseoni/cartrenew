export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import { findOrCreateMerchantByShopDomain } from "@/lib/shopify/merchant";
import {
  createAppSubscription,
  isShopifyBillingPlanId,
  type ShopifyBillingPlanId,
} from "@/lib/shopify/billing";
import {
  getBearerToken,
  verifySessionToken,
} from "@/lib/shopify/verifySessionToken";

type StoreAuthRow = {
  id: string;
  shopify_domain: string;
  shopify_access_token: string | null;
};

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
      .select("id, shopify_domain, shopify_access_token")
      .eq("shopify_domain", shop)
      .maybeSingle();

    if (error) {
      console.error("[api/app/billing/subscribe] store lookup failed", error);
      return NextResponse.json({ error: "Store lookup failed" }, { status: 500 });
    }

    const row = store as StoreAuthRow | null;
    if (!row?.shopify_access_token) {
      return NextResponse.json(
        { error: "Store is not connected. Complete Shopify OAuth first." },
        { status: 404 }
      );
    }

    const { confirmationUrl, subscriptionId } = await createAppSubscription({
      shop,
      accessToken: row.shopify_access_token,
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
      .eq("id", row.id);

    return NextResponse.json({
      confirmationUrl,
      subscriptionId,
      planId,
      shop,
    });
  } catch {
    console.error("[api/app/billing/subscribe] request failed");
    return NextResponse.json({ error: "Billing subscribe failed" }, { status: 502 });
  }
}
