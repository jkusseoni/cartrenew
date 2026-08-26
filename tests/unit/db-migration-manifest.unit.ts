import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const runner = readFileSync(
  path.join(root, "scripts/run-db-migrations.ts"),
  "utf8"
);

test("db:migrate applies Shopify billing columns before platform onboarding", () => {
  const coreMigration = "db/migrations/2026-06-20-core-shopify-schema.sql";
  const billingMigration =
    "db/migrations/2026-07-09-shopify-billing-columns.sql";
  const wooCommerceMigration =
    "db/migrations/2026-08-22-woocommerce-store-platform.sql";

  assert.ok(
    existsSync(path.join(root, billingMigration)),
    "the Shopify billing migration file must exist"
  );

  const coreIndex = runner.indexOf(`"${coreMigration}"`);
  const billingIndex = runner.indexOf(`"${billingMigration}"`);
  const wooCommerceIndex = runner.indexOf(`"${wooCommerceMigration}"`);

  assert.notEqual(coreIndex, -1, "the core Shopify migration must be scheduled");
  assert.notEqual(
    billingIndex,
    -1,
    "the Shopify billing migration must be scheduled"
  );
  assert.notEqual(
    wooCommerceIndex,
    -1,
    "the WooCommerce platform migration must be scheduled"
  );
  assert.ok(
    coreIndex < billingIndex && billingIndex < wooCommerceIndex,
    "billing columns must be added after the core stores table and before onboarding writes them"
  );
});
