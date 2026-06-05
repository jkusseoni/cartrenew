import "dotenv/config";

import { randomUUID } from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the merchant handshake test.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
  log: ["error"],
});

const testRunId = randomUUID();
const mockMerchantId = `mock-merchant-${testRunId}`;
const mockUrl = `https://example.com/webhooks/${testRunId}`;
const mockEventType = "handshake.test";

async function main() {
  console.log("Creating mock merchant handshake record...");

  const created = await prisma.webhookSubscription.create({
    data: {
      merchantId: mockMerchantId,
      url: mockUrl,
      eventType: mockEventType,
      secret: `test-secret-${testRunId}`,
      isActive: true,
    },
  });

  const retrieved = await prisma.webhookSubscription.findUnique({
    where: {
      id: created.id,
    },
  });

  if (!retrieved) {
    throw new Error("Mock merchant handshake record was not found after creation.");
  }

  const handshakeStatus = retrieved.isActive ? "ACTIVE" : "INACTIVE";

  console.log("Mock merchant retrieved:", retrieved.merchantId);
  console.log("Handshake status:", handshakeStatus);
}

main()
  .catch((error) => {
    console.error("Merchant handshake test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const deleted = await prisma.webhookSubscription.deleteMany({
      where: {
        merchantId: mockMerchantId,
        url: mockUrl,
        eventType: mockEventType,
      },
    });

    console.log(`Cleaned up ${deleted.count} mock merchant record(s).`);
    await prisma.$disconnect();
  });
