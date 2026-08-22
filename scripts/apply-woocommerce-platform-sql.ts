/**
 * Apply woocommerce-store-platform.sql against DATABASE_URL.
 * Usage: npx tsx scripts/apply-woocommerce-platform-sql.ts
 */
import { readFileSync } from "fs";
import path from "path";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is missing");
    process.exit(1);
  }

  const sqlPath = path.join(process.cwd(), "woocommerce-store-platform.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log("OK: woocommerce-store-platform.sql applied");

    const cols = await client.query(
      `select column_name, is_nullable
       from information_schema.columns
       where table_name = 'stores'
         and column_name = any($1::text[])
       order by column_name`,
      [["platform", "site_url", "contact_email", "store_name", "shopify_domain", "api_key"]]
    );
    console.log(
      "stores columns:",
      cols.rows
        .map((r) => `${r.column_name}(nullable=${r.is_nullable})`)
        .join(", ")
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
