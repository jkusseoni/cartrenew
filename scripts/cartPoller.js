/* eslint-disable */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const cron = require("node-cron");
const axios = require("axios");

// ✅ Fix 1: Modern strict connection override syntax format for Prisma
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

console.log("[INFO] CartRenew Poller Daemon Initialized.");

// Schedule cron to run every 15 minutes
cron.schedule("*/15 * * * *", async () => {
  const checkTimeLimit = new Date(Date.now() - 30 * 60 * 1000); // 30 mins window execution
  console.log("[" + new Date().toLocaleTimeString() + "] DB Query Auto-Triggered.");

  try {
    // ✅ Fix 2: Updated query payload fields mapping to actual schema constraints
    const unattendedCarts = await prisma.cart.findMany({
      where: {
        status: "ABANDONED", // Strict Case matching
        notified: false,
        createdAt: { lte: checkTimeLimit }
      }
    });

    if (unattendedCarts.length === 0) {
      console.log("No pending automated carts found.");
      return;
    }

    console.log("Found " + unattendedCarts.length + " abandoned checkouts processing...");

    // 2. Loop through each cart and fire execution workflows
    for (const cart of unattendedCarts) {
      // Direct targeting using absolute schema parameters fallbacks
      const targetPhone = cart.phoneNumber || cart.customerPhone;
      
      if (!targetPhone) {
        console.log(`[SKIP] Missing number entry sequence for Cart Context ID: ${cart.id}`);
        continue;
      }

      console.log("TARGET: " + targetPhone + " | AMOUNT: Rs. " + cart.totalAmount);
      
      try {
        // ✅ Fix 3: Dynamic payload keys align structure target parameters
        await axios.post("http://localhost:3000/api/whatsapp/send", {
          customerName: cart.customerName || "Customer",
          phoneNumber: targetPhone,
          cartTotalAmount: cart.totalAmount, // Key maps model definition value
          abandonedCartUrl: cart.cartUrl
        });

        console.log("WhatsApp successfully triggered to " + targetPhone);

        // Update tracking grid status internally to absolute true flag
        await prisma.cart.update({
          where: { id: cart.id },
          data: { 
            notified: true,
            status: "AI_SENT" // Match database telemetry timeline view states
          }
        });

      } catch (apiErr) {
        console.error("WhatsApp Provider API Error: ", apiErr.message);
        continue;
      }
    }

  } catch (error) {
    console.error("Cron Process Stream Error: ", error.message);
  }
});

// Start marker log
console.log("[INFO] CartRenew Poller Daemon Active and Listening...");