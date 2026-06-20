/**
 * Seeds a live Supabase `stores` row for a Shopify shop so the standalone
 * console (`/shopify`) and the webhook handler resolve a real store instead of
 * falling back to dev mock data.
 *
 * Usage:
 *   npm run seed:shopify
 *   npm run seed:shopify -- --shop=other-store.myshopify.com
 *
 * NOTE: Shopify data lives in Supabase (stores / abandoned_carts), not Prisma.
 * Prisma backs the separate Merchant/Cart models, so this seeds Supabase.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

function clean(value?: string): string {
  return (value ?? "").replace(/['"]/g, "").trim();
}

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const shop = getArg("shop") || "cartrenew-sandbox-store.myshopify.com";

  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !serviceKey) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The offline access token is only available after a real OAuth install.
  // Webhook receipt does NOT require it (HMAC uses the client secret), so we
  // seed a placeholder unless one is provided via env.
  const accessToken = clean(process.env.SHOPIFY_DEV_ACCESS_TOKEN) || "dev-offline-token-placeholder";

  const { data, error } = await supabase
    .from("stores")
    .upsert(
      {
        shopify_domain: shop,
        shopify_access_token: accessToken,
        clerk_user_id: `sandbox_${shop.replace(/[^a-z0-9]/gi, "_")}`,
      },
      { onConflict: "shopify_domain" }
    )
    .select("id, shopify_domain, created_at")
    .maybeSingle();

  if (error) {
    console.error("❌ Failed to upsert store:", error.message);
    process.exit(1);
  }

  console.log("✅ Store seeded in Supabase:");
  console.log(`   domain: ${data?.shopify_domain}`);
  console.log(`   id:     ${data?.id}`);
  console.log("\nThe /shopify console will now resolve this store and show live webhook data.");
}

main().catch((err) => {
  console.error("❌ Seed script error:", err);
  process.exit(1);
});
