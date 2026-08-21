export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import {
  createAppSubscription,
  isShopifyBillingPlanId,
  type ShopifyBillingPlanId,
} from "@/lib/shopify/billing";
import {
  getBearerToken,
  verifyShopifySessionToken,
} from "@/lib/shopify/session-token";

type StoreAuthRow = {
  id: string;
  shopify_domain: string;
  shopify_access_token: string | null;
};

/**
 * POST /api/shopify/billing/subscribe
 *
 * Auth: Shopify session token. Shop tenant comes from JWT `dest`, not the body.
 * Body: { shop?, planId, host? }
 * Creates an appSubscriptionCreate charge and returns { confirmationUrl }.
 * The merchant must be redirected to confirmationUrl to approve the charge.
 */
export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req.headers.get("authorization"));
    const verified = token ? verifyShopifySessionToken(token) : null;
    if (!verified) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      shop?: string;
      planId?: string;
      host?: string;
    } | null;

    const requestedShop = body?.shop?.trim();
    const shop = verified.shop;
    const planId = body?.planId?.trim();
    const host = body?.host?.trim();

    if (requestedShop && requestedShop !== shop) {
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
      console.error("[billing/subscribe] store lookup failed", error);
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

    return NextResponse.json({
      confirmationUrl,
      subscriptionId,
      planId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Billing subscribe failed";
    console.error("[billing/subscribe]", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
