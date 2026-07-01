/**
 * Applies CartRenew database schema in the correct order:
 *
 *   1. Prisma layer (User, Merchant, Cart, Order, WebhookSubscription)
 *      - Fresh DB  → prisma db push, then mark migrations as applied
 *      - Existing  → prisma migrate deploy only (never db push — it drops Supabase tables)
 *   2. Supabase SQL layer (stores, abandoned_carts, messages, …)
 *      - Always run idempotent SQL files after Prisma so Shopify tables survive db push on first setup
 *
 * Usage:
 *   npm run db:migrate
 *
 * Requires DATABASE_URL in .env.local (or .env).
 */
import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import path from "path";

import { config } from "dotenv";

config({ path: ".env.local" });
config();

const ROOT = process.cwd();

/** Supabase / Shopify tables — run after Prisma on every migrate. */
const SUPABASE_SQL_MIGRATIONS = [
  "db/migrations/2026-06-20-core-shopify-schema.sql",
  "db/migrations/2026-05-29-add-alerts-acknowledged.sql",
  "db/migrations/2026-06-05-add-geo-delivery-metrics.sql",
] as const;

function run(command: string) {
  console.log(`\n▶ ${command}`);
  execSync(command, {
    stdio: "inherit",
    env: process.env,
    cwd: ROOT,
  });
}

async function prismaTablesExist(): Promise<boolean> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("❌ DATABASE_URL is missing. Set it in .env.local before running db:migrate.");
    process.exit(1);
  }

  const { prisma } = await import("../lib/prisma");
  try {
    await prisma.$queryRaw`SELECT 1 FROM "Merchant" LIMIT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

function markPrismaMigrationsApplied() {
  const migrationsDir = path.join(ROOT, "prisma", "migrations");
  if (!existsSync(migrationsDir)) return;

  const names = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(path.join(migrationsDir, entry.name, "migration.sql")))
    .map((entry) => entry.name);

  for (const name of names) {
    try {
      run(`npx prisma migrate resolve --applied ${name}`);
    } catch {
      console.warn(`⚠ Could not mark migration as applied: ${name}`);
    }
  }
}

async function syncPrismaSchema() {
  console.log("\n── Step 1: Prisma schema ──");

  const exists = await prismaTablesExist();

  if (exists) {
    console.log("Prisma tables found — running migrate deploy (safe, incremental).");
    run("npx prisma migrate deploy");
    return;
  }

  console.log("No Prisma tables yet — running db push for initial setup.");
  run("npx prisma db push --accept-data-loss");
  markPrismaMigrationsApplied();
}

function runSupabaseSqlMigrations() {
  console.log("\n── Step 2: Supabase / Shopify SQL ──");

  for (const file of SUPABASE_SQL_MIGRATIONS) {
    const absolute = path.join(ROOT, file);
    if (!existsSync(absolute)) {
      console.error(`❌ Migration file not found: ${file}`);
      process.exit(1);
    }
    run(`npx prisma db execute --file ${file}`);
  }
}

async function main() {
  console.log("CartRenew db:migrate — applying schema in safe order…");
  await syncPrismaSchema();
  runSupabaseSqlMigrations();
  console.log("\n✅ Database migrations complete.");
}

main().catch((error) => {
  console.error("❌ db:migrate failed:", error);
  process.exit(1);
});
