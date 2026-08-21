export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import {
  getShopifyAppUrl,
  getShopifyClientId,
  getShopifyClientSecret,
  isValidShopDomain,
  verifyOAuthHmac,
} from "@/lib/shopify/config";
import {
  createInstallSubscription,
  getActiveAppSubscriptions,
  resolveBillingPlanFromActiveSubscription,
  toDbBillingStatus,
} from "@/lib/shopify/billing";
import { registerShopifyWebhooks } from "@/lib/shopify/webhooks";

const STATE_COOKIE = "shopify_oauth_state";

/**
 * GET /api/auth/shopify/callback
 *
 * Exchanges the OAuth code for an offline token, registers webhooks, then
 * creates a test/default Shopify Billing subscription and redirects the
 * merchant to Shopify's charge approval page.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;

    const shop = q.get("shop");
    const code = q.get("code");
    const state = q.get("state");
    const host = q.get("host");

    if (!isValidShopDomain(shop) || !code) {
      return NextResponse.json(
        { error: "Missing or invalid shop/code parameters" },
        { status: 400 }
      );
    }

    const cookieState = req.cookies.get(STATE_COOKIE)?.value;
    if (!cookieState || !state || cookieState !== state) {
      return NextResponse.json({ error: "OAuth state mismatch" }, { status: 401 });
    }

    if (!verifyOAuthHmac(q)) {
      return NextResponse.json({ error: "HMAC validation failed" }, { status: 401 });
    }

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: getShopifyClientId(),
        client_secret: getShopifyClientSecret(),
        code,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("Failed to exchange code for token", body);
      return NextResponse.json({ error: "Token exchange failed" }, { status: 502 });
    }

    const tokenJson = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
    const accessToken = tokenJson?.access_token;
    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token" }, { status: 502 });
    }

    const clerkUserId = `webhook_${shop.replace(/[^a-z0-9]/gi, "_")}`;

    const upsertRes = await supabaseAdmin
      .from("stores")
      .upsert(
        {
          shopify_domain: shop,
          shopify_access_token: accessToken,
          clerk_user_id: clerkUserId,
        },
        { onConflict: "shopify_domain" }
      )
      .select("id, billing_plan")
      .maybeSingle();

    if (upsertRes.error) {
      console.error("Failed to upsert store", upsertRes.error);
      return NextResponse.json({ error: "Failed to save store" }, { status: 500 });
    }

    const fetchedStore = upsertRes.data;

    const registered = await registerShopifyWebhooks(shop, accessToken);

    if (fetchedStore?.id && registered.length > 0) {
      await supabaseAdmin
        .from("stores")
        .update({ webhook_ids: registered })
        .eq("id", fetchedStore.id);
    }

    // Preserve an existing active subscription during re-auth/reinstall.
    try {
      const activeSubscriptions = await getActiveAppSubscriptions(shop, accessToken);
      const activeSubscription =
        activeSubscriptions.find((subscription) => subscription.status === "ACTIVE") ??
        activeSubscriptions[0];

      if (activeSubscription) {
        if (fetchedStore?.id) {
          const { error: billingSyncError } = await supabaseAdmin
            .from("stores")
            .update({
              billing_plan: resolveBillingPlanFromActiveSubscription(
                activeSubscription.name,
                fetchedStore.billing_plan
              ),
              billing_status: toDbBillingStatus(activeSubscription.status),
              shopify_subscription_id: activeSubscription.id,
              billing_current_period_end: activeSubscription.currentPeriodEnd,
            })
            .eq("id", fetchedStore.id);

          if (billingSyncError) {
            throw new Error(`Failed to sync active Shopify billing: ${billingSyncError.message}`);
          }
        }

        const returnParams = new URLSearchParams({ shop, billing: "active" });
        if (host) returnParams.set("host", host);
        const response = NextResponse.redirect(
          `${getShopifyAppUrl()}/app?${returnParams.toString()}`
        );
        response.cookies.delete(STATE_COOKIE);
        return response;
      }

      const { confirmationUrl } = await createInstallSubscription({
        shop,
        accessToken,
        host,
      });

      const response = NextResponse.redirect(confirmationUrl);
      response.cookies.delete(STATE_COOKIE);
      return response;
    } catch (billingError) {
      console.error("[oauth/callback] install billing failed, falling back to app", billingError);
    }

    const returnParams = new URLSearchParams({ shop, billing: "setup_failed" });
    if (host) returnParams.set("host", host);
    const response = NextResponse.redirect(
      `${getShopifyAppUrl()}/app?${returnParams.toString()}`
    );
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("Shopify OAuth callback error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
