/* eslint-disable */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const cron = require("node-cron");
const axios = require("axios");

// Prisma 6/7 modern strict connection format (Bypasses config parsing)
const prisma = new PrismaClient({
  url: "postgresql://postgres.xolermujthasddrenoyx:Vijay%408619%25@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
});

console.log("[INFO] CartRenew Poller Daemon Initialized.");

// Schedule cron to run every 15 minutes
cron.schedule("*/15 * * * *", async () => {
  const checkTimeLimit = new Date(Date.now() - 30 * 60 * 1000);
  console.log("[" + new Date().toLocaleTimeString() + "] DB Query Auto-Triggered.");

  try {
    // 1. Fetch abandoned carts
    const unattendedCarts = await prisma.cart.findMany({
      where: {
        status: "abandoned",
        notified: false,
        createdAt: { lte: checkTimeLimit }
      }
    });

    if (unattendedCarts.length === 0) {
      console.log("No pending carts found.");
      return;
    }

    console.log("Found " + unattendedCarts.length + " abandoned checkouts.");

    // 2. Loop through each cart and send alert
    for (const cart of unattendedCarts) {
      console.log("TARGET: " + cart.phoneNumber + " | AMOUNT: Rs. " + cart.cartTotalAmount);
      
      try {
        // Send WhatsApp notification
        await axios.post("http://localhost:3000/api/whatsapp/send", {
          customerName: cart.customerName,
          phoneNumber: cart.phoneNumber,
          cartTotalAmount: cart.cartTotalAmount,
          abandonedCartUrl: cart.cartUrl
        });

        console.log("WhatsApp sent to " + cart.phoneNumber);

        // Update database notification status
        await prisma.cart.update({
          where: { id: cart.id },
          data: { notified: true }
        });

      } catch (apiErr) {
        console.error("API Error: ", apiErr.message);
        continue;
      }
    }

  } catch (error) {
    console.error("Cron Error: ", error.message);
  }
});

// Start marker log
console.log("[INFO] CartRenew Poller Daemon Active...");