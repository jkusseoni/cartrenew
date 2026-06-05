CREATE TYPE "LifetimeDealTier" AS ENUM ('SINGLE', 'DOUBLE', 'MULTIPLE');

ALTER TABLE "Merchant"
ADD COLUMN "subscriptionTier" "LifetimeDealTier",
ADD COLUMN "lifetimeDealActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lifetimeDealPurchasedAt" TIMESTAMP(3),
ADD COLUMN "storeLimit" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "monthlyRecoveryLimit" INTEGER,
ADD COLUMN "tempTwoFactorSecret" TEXT,
ADD COLUMN "twoFactorSecret" TEXT,
ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeCheckoutSessionId" TEXT,
ADD COLUMN "stripePaymentIntentId" TEXT,
ADD COLUMN "tierConfig" JSONB;

CREATE INDEX "Merchant_subscriptionTier_idx" ON "Merchant"("subscriptionTier");
CREATE INDEX "Merchant_stripeCustomerId_idx" ON "Merchant"("stripeCustomerId");
CREATE INDEX "Merchant_stripeCheckoutSessionId_idx" ON "Merchant"("stripeCheckoutSessionId");
