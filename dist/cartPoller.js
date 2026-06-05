"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const prisma = new client_1.PrismaClient();
// Autonomous Cron Loop — Runs every 15 minutes
node_cron_1.default.schedule("*/15 * * * *", async () => {
    const checkTimeLimit = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    console.log(`[${new Date().toLocaleTimeString()}] DB Query Auto-Triggered`);
    try {
        // 1. Find abandoned carts
        const unattendedCarts = await prisma.cart.findMany({
            where: {
                status: "abandoned",
                notified: false,
                createdAt: {
                    lte: checkTimeLimit,
                },
            },
        });
        if (unattendedCarts.length === 0) {
            console.log(`[${new Date().toLocaleTimeString()}] System Status: No pending abandoned carts found.`);
            return;
        }
        console.log(`[${new Date().toLocaleTimeString()}] Found ${unattendedCarts.length} abandoned checkout(s).`);
        // 2. Process each cart
        for (const cart of unattendedCarts) {
            console.log("\n-----------------------------------------------");
            console.log(`AUTONOMOUS PIPELINE DETECTED`);
            console.log(`TARGET PHONE : ${cart.phoneNumber}`);
            console.log(`AMOUNT : ₹${cart.totalAmount}`);
            console.log("-----------------------------------------------\n");
            // 3. Send WhatsApp recovery via API
            try {
                await axios_1.default.post("http://localhost:3000/api/whatsapp/send", {
                    customerName: cart.customerName,
                    phoneNumber: cart.phoneNumber,
                    cartTotalAmount: cart.totalAmount,
                    abandonCartUrl: cart.cartUrl,
                });
                console.log(`[${new Date().toLocaleTimeString()}] WhatsApp sent to ${cart.phoneNumber}`);
            }
            catch (apiError) {
                console.error(`[${new Date().toLocaleTimeString()}] WhatsApp API Error:`, apiError instanceof Error ? apiError.message : apiError);
                continue; // Skip to next cart on error
            }
            // 4. Mark as notified
            await prisma.cart.update({
                where: { id: cart.id },
                data: { notified: true },
            });
            console.log(`[${new Date().toLocaleTimeString()}] Record ${cart.id} processed successfully.`);
        }
    }
    catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] Automation Cron Error:`, error instanceof Error ? error.message : error);
    }
});
console.log("[INFO] CartRenew Database Poller Daemon Active.");
