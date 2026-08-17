/**
 * One-off: apply woocommerce-store-api-key.sql against DATABASE_URL.
 * Usage: npx tsx scripts/apply-woocommerce-sql.ts
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

  const sqlPath = path.join(process.cwd(), "woocommerce-store-api-key.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log("OK: woocommerce-store-api-key.sql applied");

    const cols = await client.query(
      `select column_name
       from information_schema.columns
       where table_name = 'abandoned_carts'
         and column_name = any($1::text[])
       order by column_name`,
      [
        [
          "customer_phone",
          "checkout_url",
          "cart_value",
          "items",
          "status",
          "customer_name",
          "store_id",
          "platform",
          "external_cart_key",
          "message_sent_at",
          "shopify_cart_token",
        ],
      ]
    );
    console.log(
      "abandoned_carts columns:",
      cols.rows.map((r) => r.column_name).join(", ")
    );

    const storeCols = await client.query(
      `select column_name from information_schema.columns
       where table_name = 'stores' and column_name = 'api_key'`
    );
    console.log("stores.api_key present:", storeCols.rows.length > 0);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
