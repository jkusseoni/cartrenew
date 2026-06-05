ALTER TABLE "Cart"
ADD COLUMN "recoveryMessage" TEXT,
ADD COLUMN "recoveryMessageModel" TEXT,
ADD COLUMN "recoveryMessagePrompt" TEXT,
ADD COLUMN "recoveryMessageAt" TIMESTAMP(3);
