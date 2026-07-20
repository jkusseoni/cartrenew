/* eslint-disable */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const cron = require("node-cron");
const axios = require("axios");

if (!process.env.DATABASE_URL) {
  console.error("[FATAL] DATABASE_URL is not set — cartPoller cannot start.");
  process.exit(1);
}

// Prisma 7 requires adapter (or accelerateUrl); datasources override is no longer valid.
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

console.log("[INFO] CartRenew Poller Daemon Initialized.");

const checkAbandonedCartsNow = async () => {
  const checkTimeLimit = new Date(Date.now() - 30 * 60 * 1000); // 30 mins window execution
  console.log("[MANUAL] Checking database instantly...");
  console.log("[" + new Date().toLocaleTimeString() + "] DB Query Auto-Triggered.");

  try {
    const unattendedCarts = await prisma.cart.findMany({
      where: {
        status: "ABANDONED", // Strict Case matching
        notified: false,
        createdAt: { lte: checkTimeLimit },
      },
    });

    console.log(`Found ${unattendedCarts.length} matching entries.`);

    if (unattendedCarts.length === 0) {
      console.log("No pending automated carts found.");
      return;
    }

    console.log("Found " + unattendedCarts.length + " abandoned checkouts processing...");

    for (const cart of unattendedCarts) {
      const targetPhone = cart.phoneNumber || cart.customerPhone;

      if (!targetPhone) {
        console.log(`[SKIP] Missing number entry sequence for Cart Context ID: ${cart.id}`);
        continue;
      }

      console.log("TARGET: " + targetPhone + " | AMOUNT: Rs. " + cart.totalAmount);

      try {
        await axios.post("http://localhost:3000/api/whatsapp/send", {
          customerName: cart.customerName || "Customer",
          phoneNumber: targetPhone,
          cartTotalAmount: cart.totalAmount,
          abandonedCartUrl: cart.cartUrl,
        });

        console.log("WhatsApp successfully triggered to " + targetPhone);

        await prisma.cart.update({
          where: { id: cart.id },
          data: {
            notified: true,
            status: "AI_SENT",
            recoveryMessageAt: new Date(),
          },
        });
      } catch (apiErr) {
        console.error("WhatsApp Provider API Error: ", apiErr.message);
        continue;
      }
    }
  } catch (err) {
    console.error("Cron Process Stream Error: ", err.message);
  }
};

// Schedule cron to run every 15 minutes
cron.schedule("*/15 * * * *", () => {
  checkAbandonedCartsNow();
});

// Start marker log
console.log("[INFO] CartRenew Poller Daemon Active and Listening...");

// Temporary: fire immediately on script start (outside cron wrapper)
checkAbandonedCartsNow();
