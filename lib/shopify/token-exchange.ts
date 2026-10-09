import * as Sentry from "@sentry/nextjs";

import { supabaseAdmin } from "@/lib/supabase";
import {
  getShopifyClientId,
  getShopifyClientSecret,
} from "@/lib/shopify/config";
import { findOrCreateMerchantByShopDomain } from "@/lib/shopify/merchant";
import { registerShopifyWebhooks } from "@/lib/shopify/webhooks";

export type ShopifyInstallResult =
  | {
      ok: true;
      shop: string;
      storeId: string;
      accessToken: string;
      /** Row existed but its token had been cleared by app/uninstalled. */
      reinstalled: boolean;
    }
  | { ok: false; status: number; error: string };

/**
 * Managed install: exchange an App Bridge session token for an offline access
 * token and persist it on the `stores` row.
 *
 * `shop` must come from the verified session token's `dest` claim.
 * Used by /api/auth/token-exchange and by /api/app/billing/subscribe when a
 * reinstalled store has no token yet.
 */
export async function installShopifyStoreFromSessionToken(
  shop: string,
  sessionToken: string
): Promise<ShopifyInstallResult> {
  const clientId = getShopifyClientId();
  const clientSecret = getShopifyClientSecret();
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      status: 500,
      error: "Shopify app credentials are not configured",
    };
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
    return { ok: false, status: 401, error: "Token exchange failed" };
  }

  const tokenJson = (await tokenRes.json().catch(() => null)) as {
    access_token?: string;
  } | null;
  const accessToken = tokenJson?.access_token;
  if (!accessToken) {
    return { ok: false, status: 502, error: "Missing access token" };
  }

  // Prisma is optional infra — never block the install response on it.
  void findOrCreateMerchantByShopDomain(shop).catch((merchantError) => {
    console.error(
      "[token-exchange] merchant upsert failed (background):",
      shop,
      merchantError
    );
    Sentry.captureException(merchantError, {
      tags: { area: "token-exchange", step: "prisma-merchant" },
      extra: { shop },
    });
  });

  // Preserve existing clerk_user_id (e.g. standalone Clerk login). Only set the
  // synthetic webhook_* value when inserting a brand-new store row.
  const { data: existingStore, error: lookupError } = await supabaseAdmin
    .from("stores")
    .select("id, shopify_access_token")
    .eq("shopify_domain", shop)
    .maybeSingle();

  if (lookupError) {
    console.error("[token-exchange] Failed to look up store", lookupError);
    return { ok: false, status: 500, error: "Failed to save store" };
  }

  let storeId: string | undefined;
  let reinstalled = false;

  if (existingStore?.id) {
    reinstalled = !existingStore.shopify_access_token;
    // app/uninstalled cancels the old subscription on Shopify's side, so its
    // plan/subscription id must not carry over into the new install.
    const updates: Record<string, unknown> = reinstalled
      ? {
          shopify_access_token: accessToken,
          billing_status: "pending",
          billing_plan: null,
          shopify_subscription_id: null,
          billing_current_period_end: null,
        }
      : { shopify_access_token: accessToken };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("stores")
      .update(updates)
      .eq("id", existingStore.id)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("[token-exchange] Failed to update store", updateError);
      return { ok: false, status: 500, error: "Failed to save store" };
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
      // Race: another request inserted the same shop — treat as success.
      if (insertError.code === "23505") {
        const { data: raced } = await supabaseAdmin
          .from("stores")
          .select("id")
          .eq("shopify_domain", shop)
          .maybeSingle();
        storeId = raced?.id;
      }
      if (!storeId) {
        console.error("[token-exchange] Failed to insert store", insertError);
        return { ok: false, status: 500, error: "Failed to save store" };
      }
    } else {
      storeId = inserted?.id;
    }
  }

  if (!storeId) {
    return { ok: false, status: 500, error: "Store row was not committed" };
  }

  const committedStoreId = storeId;

  // Best-effort webhooks — do not hold the install response open.
  void registerShopifyWebhooks(shop, accessToken)
    .then(async (registered) => {
      if (registered.length === 0) {
        console.error(
          "[token-exchange] webhook registration returned no topics (background):",
          shop
        );
        Sentry.captureMessage(
          "Shopify webhook registration returned no topics after install",
          {
            level: "error",
            tags: { area: "token-exchange", step: "webhooks" },
            extra: { shop, storeId: committedStoreId },
          }
        );
        return;
      }
      const { error: webhookUpdateError } = await supabaseAdmin
        .from("stores")
        .update({ webhook_ids: registered })
        .eq("id", committedStoreId);
      if (webhookUpdateError) {
        console.error(
          "[token-exchange] webhook_ids update failed (background):",
          shop,
          webhookUpdateError
        );
        Sentry.captureException(webhookUpdateError, {
          tags: { area: "token-exchange", step: "webhook-ids" },
          extra: { shop, storeId: committedStoreId },
        });
      }
    })
    .catch((webhookError) => {
      console.error(
        "[token-exchange] webhook registration failed (background):",
        shop,
        webhookError
      );
      Sentry.captureException(webhookError, {
        tags: { area: "token-exchange", step: "webhooks" },
        extra: { shop, storeId: committedStoreId },
      });
    });

  return {
    ok: true,
    shop,
    storeId: committedStoreId,
    accessToken,
    reinstalled,
  };
}
