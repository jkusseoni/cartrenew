export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import { getShopifyAppUrl, isValidShopDomain } from "@/lib/shopify/config";
import {
  getActiveAppSubscriptions,
  resolveBillingPlanFromActiveSubscription,
  toDbBillingStatus,
} from "@/lib/shopify/billing";

/**
 * GET /api/shopify/billing/callback
 *
 * Shopify redirects here after the merchant approves/declines the charge.
 * We re-query active subscriptions, persist status, then return to the embedded app.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");
  const plan = url.searchParams.get("plan");

  if (!isValidShopDomain(shop)) {
    return NextResponse.redirect(`${getShopifyAppUrl()}/app?billing=invalid_shop`);
  }

  try {
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("id, shopify_access_token, billing_plan, shopify_subscription_id")
      .eq("shopify_domain", shop)
      .maybeSingle();

    if (store?.shopify_access_token) {
      const active = await getActiveAppSubscriptions(shop, store.shopify_access_token);
      const match =
        active.find((sub) => sub.id === store.shopify_subscription_id) ||
        active.find((sub) => sub.status === "ACTIVE") ||
        active[0];

      if (match) {
        await supabaseAdmin
          .from("stores")
          .update({
            billing_status: toDbBillingStatus(match.status),
            shopify_subscription_id: match.id,
            billing_plan: resolveBillingPlanFromActiveSubscription(
              match.name,
              store.billing_plan
            ),
            billing_current_period_end: match.currentPeriodEnd,
          })
          .eq("id", store.id);
      }
    }
  } catch (error) {
    console.error("[billing/callback] failed to sync subscription", error);
  }

  const returnParams = new URLSearchParams({ shop, billing: "ok" });
  if (host) returnParams.set("host", host);
  if (plan) returnParams.set("plan", plan);

  return NextResponse.redirect(`${getShopifyAppUrl()}/app?${returnParams.toString()}`);
}
