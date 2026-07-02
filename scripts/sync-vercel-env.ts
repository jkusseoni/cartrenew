/**
 * Syncs critical production env vars from .env.local → Vercel (production + preview).
 *
 * Usage:
 *   npm run vercel:env:sync
 *
 * Requires: vercel CLI logged in + project linked (`vercel link`).
 */
import { execSync } from "child_process";

import { config } from "dotenv";

config({ path: ".env.local", override: true });
config({ path: ".env", override: true });

const ENVIRONMENTS = ["production", "preview"] as const;

/** Vars required for Shopify embedded app + Supabase on Vercel. */
const SYNC_VARS = [
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
  "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
] as const;

const SENSITIVE = new Set([
  "SHOPIFY_CLIENT_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
]);

function listedVars(): Set<string> {
  const out = execSync("vercel env ls", { encoding: "utf8" });
  const names = new Set<string>();
  for (const line of out.split("\n")) {
    const match = line.match(/^\s+([A-Z0-9_]+)\s+/);
    if (match) names.add(match[1]);
  }
  return names;
}

function upsertVar(name: string, value: string, environment: (typeof ENVIRONMENTS)[number], exists: boolean) {
  const sensitiveFlag = SENSITIVE.has(name) ? " --sensitive" : "";
  const escaped = value.replace(/"/g, '\\"');

  if (exists) {
    execSync(
      `vercel env update ${name} ${environment} --value "${escaped}" -y${sensitiveFlag}`,
      { stdio: "inherit" }
    );
  } else {
    execSync(
      `vercel env add ${name} ${environment} --value "${escaped}" -y${sensitiveFlag}`,
      { stdio: "inherit" }
    );
  }
}

function main() {
  try {
    execSync("vercel env ls", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    console.error("❌ Vercel project not linked. Run: vercel link --yes --project cartrenew");
    process.exit(1);
  }

  // Prefer Supabase pooler URL from .env for serverless (falls back to .env.local direct).
  const databaseUrl =
    process.env.DATABASE_URL?.includes("pooler.supabase.com")
      ? process.env.DATABASE_URL
      : process.env.DATABASE_URL;

  const values: Record<string, string | undefined> = {};
  for (const key of SYNC_VARS) {
    values[key] = key === "DATABASE_URL" ? databaseUrl : process.env[key];
  }

  const missing = SYNC_VARS.filter((k) => !values[k]?.trim());
  if (missing.length) {
    console.error("❌ Missing in .env.local:", missing.join(", "));
    process.exit(1);
  }

  console.log("Syncing env vars to Vercel (production + preview)…\n");
  console.log(`Shopify client_id: ${values.NEXT_PUBLIC_SHOPIFY_CLIENT_ID}`);
  console.log(`SHOPIFY_APP_URL:   ${values.SHOPIFY_APP_URL}\n`);

  const existing = listedVars();

  for (const env of ENVIRONMENTS) {
    console.log(`\n── ${env} ──`);
    for (const key of SYNC_VARS) {
      const value = values[key]!;
      console.log(`  ${existing.has(key) ? "update" : "add"} ${key}`);
      upsertVar(key, value, env, existing.has(key));
    }
  }

  console.log("\n✅ Vercel env sync complete. Redeploy production for changes to take effect:");
  console.log("   vercel --prod");
}

main();
