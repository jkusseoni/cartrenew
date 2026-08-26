export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import {
  getShopifyClientId,
  getShopifyClientSecret,
} from "@/lib/shopify/config";
import { findOrCreateMerchantByShopDomain } from "@/lib/shopify/merchant";
import { registerShopifyWebhooks } from "@/lib/shopify/webhooks";
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

    const clientId = getShopifyClientId();
    const clientSecret = getShopifyClientSecret();
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { ok: false, error: "Shopify app credentials are not configured" },
        { status: 500 }
      );
    }

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: sessionToken,
        subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
        requested_token_type:
          "urn:shopify:params:oauth:token-type:offline-access-token",
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[token-exchange] Shopify rejected exchange:", body);
      return NextResponse.json(
        { ok: false, error: "Token exchange failed" },
        { status: 401 }
      );
    }

    const tokenJson = (await tokenRes.json().catch(() => null)) as {
      access_token?: string;
    } | null;
    const accessToken = tokenJson?.access_token;
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "Missing access token" },
        { status: 502 }
      );
    }

    // Prisma merchant row (optional infra) — finish write before responding when possible.
    let merchantId: string | undefined;
    try {
      const merchant = await findOrCreateMerchantByShopDomain(shop);
      merchantId = merchant.id;
    } catch (merchantError) {
      console.warn(
        "[token-exchange] merchant upsert skipped (Supabase store is source of truth for /app):",
        merchantError
      );
    }

    // Preserve existing clerk_user_id (e.g. standalone Clerk login). Only set the
    // synthetic webhook_* value when inserting a brand-new store row.
    const { data: existingStore, error: lookupError } = await supabaseAdmin
      .from("stores")
      .select("id, clerk_user_id")
      .eq("shopify_domain", shop)
      .maybeSingle();

    if (lookupError) {
      console.error("[token-exchange] Failed to look up store", lookupError);
      return NextResponse.json(
        { ok: false, error: "Failed to save store" },
        { status: 500 }
      );
    }

    let storeId: string | undefined;

    if (existingStore?.id) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("stores")
        .update({
          shopify_access_token: accessToken,
          billing_status: "pending",
        })
        .eq("id", existingStore.id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("[token-exchange] Failed to update store", updateError);
        return NextResponse.json(
          { ok: false, error: "Failed to save store" },
          { status: 500 }
        );
      }
      storeId = updated?.id ?? existingStore.id;
    } else {
      const clerkUserId = `webhook_${shop.replace(/[^a-z0-9]/gi, "_")}`;
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("stores")
        .insert({
          shopify_domain: shop,
          shopify_access_token: accessToken,
          clerk_user_id: clerkUserId,
          platform: "shopify",
          billing_status: "pending",
        })
        .select("id")
        .maybeSingle();

      if (insertError) {
        // Race: a webhook may have inserted this shop with a null token after
        // our lookup. Persist the exchanged token on that winning row before
        // reporting install success, without changing its billing state.
        if (insertError.code === "23505") {
          const { data: raced, error: raceUpdateError } = await supabaseAdmin
            .from("stores")
            .update({ shopify_access_token: accessToken })
            .eq("shopify_domain", shop)
            .select("id")
            .maybeSingle();
          if (raceUpdateError) {
            console.error(
              "[token-exchange] Failed to update concurrently inserted store",
              raceUpdateError
            );
          } else {
            storeId = raced?.id;
          }
        }
        if (!storeId) {
          console.error("[token-exchange] Failed to insert store", insertError);
          return NextResponse.json(
            { ok: false, error: "Failed to save store" },
            { status: 500 }
          );
        }
      } else {
        storeId = inserted?.id;
      }
    }

    if (!storeId) {
      return NextResponse.json(
        { ok: false, error: "Store row was not committed" },
        { status: 500 }
      );
    }

    // Best-effort webhooks — NEVER fail install if registration fails.
    // Brand-new empty stores must still load the embedded dashboard.
    try {
      const registered = await registerShopifyWebhooks(shop, accessToken);
      if (registered.length > 0) {
        const { error: webhookUpdateError } = await supabaseAdmin
          .from("stores")
          .update({ webhook_ids: registered })
          .eq("id", storeId);
        if (webhookUpdateError) {
          console.warn(
            "[token-exchange] webhook_ids update skipped:",
            webhookUpdateError
          );
        }
      }
    } catch (webhookError) {
      console.warn("[token-exchange] webhook registration skipped:", webhookError);
    }

    return NextResponse.json({ ok: true, shop, storeId, merchantId });
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
