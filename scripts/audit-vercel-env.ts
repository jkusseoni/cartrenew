/**
 * Lists required Vercel env vars (presence only — does not print secret values).
 * Run: npm run vercel:env:audit
 */
import { execSync } from "child_process";

import { config } from "dotenv";

config({ path: ".env.local", override: true });

const REQUIRED = [
  "NEXT_PUBLIC_SHOPIFY_CLIENT_ID",
  "SHOPIFY_CLIENT_SECRET",
  "SHOPIFY_APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
] as const;

function listedVars(): Set<string> {
  const out = execSync("vercel env ls", { encoding: "utf8" });
  const names = new Set<string>();
  for (const line of out.split("\n")) {
    const match = line.match(/^\s+([A-Z0-9_]+)\s+/);
    if (match) names.add(match[1]);
  }
  return names;
}

function main() {
  const vercel = listedVars();
  const localClientId = process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID ?? "(missing)";
  const linkedClientId = "b0d8dbf013b051fc9ba20c1c5df304ca";

  console.log("CartRenew — Vercel env presence audit\n");
  console.log(`Local NEXT_PUBLIC_SHOPIFY_CLIENT_ID : ${localClientId}`);
  console.log(`Linked toml client_id                 : ${linkedClientId}`);
  console.log(
    localClientId === linkedClientId
      ? "✅ Local client_id matches linked toml\n"
      : "❌ Local client_id does NOT match linked toml\n"
  );

  let missing = 0;
  for (const key of REQUIRED) {
    const ok = vercel.has(key);
    console.log(`${key}: ${ok ? "present on Vercel" : "MISSING on Vercel"}`);
    if (!ok) missing++;
  }

  console.log(
    missing === 0
      ? "\n✅ All required vars exist on Vercel. Run npm run vercel:env:sync if values may be stale."
      : `\n⚠ ${missing} var(s) missing — run npm run vercel:env:sync`
  );
}

main();
