-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN IF NOT EXISTS "shopDomain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Merchant_shopDomain_key" ON "Merchant"("shopDomain");
