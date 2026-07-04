-- Baseline Prisma tables (required for shadow DB replay; prod was originally bootstrapped via db push)
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'CANCELLED', 'FAILED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "whatsappNum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "cartUrl" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABANDONED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT,
    "phoneNumber" TEXT,
    "notified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookSubscription" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationOtp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Merchant_userId_idx" ON "Merchant"("userId");
CREATE INDEX "Cart_merchantId_idx" ON "Cart"("merchantId");
CREATE INDEX "Cart_customerPhone_idx" ON "Cart"("customerPhone");
CREATE INDEX "Cart_status_idx" ON "Cart"("status");
CREATE INDEX "WebhookSubscription_merchantId_idx" ON "WebhookSubscription"("merchantId");
CREATE UNIQUE INDEX "WebhookSubscription_merchantId_url_eventType_key" ON "WebhookSubscription"("merchantId", "url", "eventType");
CREATE UNIQUE INDEX "Order_shopifyOrderId_key" ON "Order"("shopifyOrderId");
CREATE INDEX "Order_phoneNumber_idx" ON "Order"("phoneNumber");

ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Cart"
ADD COLUMN "recoveryMessage" TEXT,
ADD COLUMN "recoveryMessageModel" TEXT,
ADD COLUMN "recoveryMessagePrompt" TEXT,
ADD COLUMN "recoveryMessageAt" TIMESTAMP(3);
