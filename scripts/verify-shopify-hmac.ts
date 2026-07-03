/**
 * Local HMAC self-test for Shopify compliance webhooks.
 * Run: npm run shopify:hmac:test
 */
import crypto from "crypto";

import { config } from "dotenv";

import { getShopifyClientSecret, verifyWebhookHmac } from "@/lib/shopify/config";

config({ path: ".env.local", override: true });
config({ path: ".env", override: true });

const sampleBody = JSON.stringify({
  shop_id: 123,
  shop_domain: "example.myshopify.com",
});

const secret = getShopifyClientSecret();
if (!secret) {
  console.error("❌ SHOPIFY_CLIENT_SECRET / SHOPIFY_API_SECRET is missing locally.");
  process.exit(1);
}

const validHmac = crypto.createHmac("sha256", secret).update(sampleBody, "utf8").digest("base64");

const valid = verifyWebhookHmac(sampleBody, validHmac);
const invalid = verifyWebhookHmac(sampleBody, "bad-signature");

console.log("Shopify webhook HMAC self-test");
console.log(`  secret configured : yes (${secret.startsWith("shpss_") ? "shpss_*" : "custom"})`);
console.log(`  valid signature   : ${valid ? "✅ pass" : "❌ fail"}`);
console.log(`  invalid signature : ${invalid ? "❌ fail (should reject)" : "✅ rejected"}`);

if (!valid || invalid) {
  process.exit(1);
}

console.log("\n✅ HMAC verification logic is correct. Sync Vercel env if production still fails.");
