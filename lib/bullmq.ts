import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@/lib/prisma';

// Next.js hot-reloads se multiple connections aur workers create hone se bachne ke liye global initialization
const globalForRedis = global as unknown as {
  redisConnection: IORedis | undefined;
  whatsappWorker: Worker | undefined;
};

// 1. Singleton Redis Connection Setup
export const connection =
  globalForRedis.redisConnection ||
  new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null, // BullMQ worker ke liye yeh setting compulsory hai
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redisConnection = connection;

const bullMqConnection = connection as unknown as ConnectionOptions;

// 2. WhatsApp Queue Initialization
export const whatsappQueue = new Queue('WhatsAppRecovery', { connection: bullMqConnection });

// 3. Helper function: Phone number ko clean aur format karne ke liye (Meta strictly digits expect karta hai country code ke sath)
function sanitizePhoneNumber(phone: string): string {
  // Saare non-numeric characters ko remove karein (plus, space, hyphens hatayega)
  let cleaned = phone.replace(/\D/g, '');

  // Agar phone 10 digits ka hai aur country code missing hai, toh default Indian code '91' lagayein
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }

  return cleaned;
}

// 4. Singleton Worker: Background me real-time WhatsApp deliveries handle karne ke liye
if (!globalForRedis.whatsappWorker) {
  globalForRedis.whatsappWorker = new Worker(
    'WhatsAppRecovery',
    async (job) => {
      const { cartId, phoneNumber, messagePayload } = job.data;
      console.log(`🚀 [BullMQ] Job ${job.id} started for Cart ID: ${cartId}`);

      // Environment variables se credentials fetch karein
      const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
      const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        console.error("❌ [BullMQ] WhatsApp configuration keys missing hain .env me!");
        throw new Error("Missing WhatsApp API environment configurations");
      }

      // Customer number format karein
      const formattedPhone = sanitizePhoneNumber(phoneNumber);
      const textMessage = messagePayload.text;

      // Meta WhatsApp Cloud API Endpoint Setup (v20.0 Standard Endpoint)
      const metaUrl = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

      // Meta standard message payload design
      const whatsappPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: {
          preview_url: true, // Link preview enable karein taaki checkout link mast dikhe
          body: textMessage,
        },
      };

      try {
        // Meta API ko POST request hit karein
        const response = await fetch(metaUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(whatsappPayload),
        });

        const result = await response.json();

        // Agar response 200 ya 201 nahi hai toh check karein
        if (!response.ok) {
          console.error(`❌ [BullMQ] Meta WhatsApp API error for Job ${job.id}:`, result);
          throw new Error(result.error?.message || "Meta API request failed");
        }

        const messageId = result.messages?.[0]?.id;
        console.log(`📥 [BullMQ] Message successfully dispatched. Meta Message ID: ${messageId}`);

        // 5. Database me checkout status aur transaction updates sync karein
        if (cartId) {
          await prisma.cart.update({
            where: { id: String(cartId) },
            data: {
              status: "message_sent", // Status trigger update karein
              // Agar aapke schema me messageId ya metadata save karne ka custom fields hai:
              // lastMessageId: messageId,
            },
          });
          console.log(`💾 [Prisma] Cart ${cartId} status successfully updated to 'message_sent'`);
        }

        console.log(`✅ [BullMQ] Job ${job.id} finished successfully!`);
      } catch (error: unknown) {
        console.error(`💥 [BullMQ] Delivery execution failed for job ${job.id}:`, getErrorMessage(error));
        throw error; // Job throw karein taaki queue automatically exponential delay se retry kar sake
      }
    },
    {
      connection: bullMqConnection,
      // WhatsApp rates limit aur templates stability parameters configures karein
      limiter: {
        max: 10,       // Max 10 messages push allow honge
        duration: 1000 // Har 1 second ke phase me rate speed restrict rahegi
      }
    }
  );
}

export const worker = globalForRedis.whatsappWorker;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
