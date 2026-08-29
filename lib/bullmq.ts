import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/services/whatsapp-meta';

// Next.js hot-reloads se multiple connections aur workers create hone se bachne ke liye global initialization
const globalForRedis = global as unknown as {
  redisConnection: IORedis | undefined;
  whatsappWorker: Worker | undefined;
};

function getRedisUrl() {
  const url = process.env.REDIS_URL?.trim();

  if (url) {
    return url;
  }

  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('REDIS_URL is not configured. Add your Upstash URL in Vercel Environment Variables.');
  }

  return 'redis://127.0.0.1:6379';
}

// 1. Singleton Redis Connection Setup
export const connection =
  globalForRedis.redisConnection ||
  new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null, // BullMQ worker ke liye yeh setting compulsory hai
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redisConnection = connection;

const bullMqConnection = connection as unknown as ConnectionOptions;

// 2. WhatsApp Queue Initialization
export const whatsappQueue = new Queue('WhatsAppRecovery', { connection: bullMqConnection });

// 3. Singleton Worker: Meta template sends via WhatsApp Cloud API
if (!globalForRedis.whatsappWorker) {
  globalForRedis.whatsappWorker = new Worker(
    'WhatsAppRecovery',
    async (job) => {
      const { cartId, phoneNumber, messagePayload } = job.data;
      console.log(`🚀 [BullMQ] Job ${job.id} started for Cart ID: ${cartId}`);

      const templateName =
        messagePayload?.templateName || 'abandoned_cart_reminder';
      const bodyVariables: string[] = Array.isArray(messagePayload?.bodyVariables)
        ? messagePayload.bodyVariables
        : [];

      try {
        const result = await sendWhatsAppMessage(phoneNumber, {
          templateName,
          languageCode: messagePayload?.languageCode,
          bodyVariables,
        });

        if (!result.success) {
          console.error(`❌ [BullMQ] Meta WhatsApp API error for Job ${job.id}:`, result.error);
          throw new Error(result.error || 'Meta API request failed');
        }

        console.log(
          `📥 [BullMQ] Template dispatched. Meta Message ID: ${result.messageId}` +
            (messagePayload?.offerLine ? ' (offerLine stored, not sent)' : '')
        );

        if (cartId) {
          await prisma.cart.update({
            where: { id: String(cartId) },
            data: {
              status: 'message_sent',
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
        max: 10, // Max 10 messages push allow honge
        duration: 1000, // Har 1 second ke phase me rate speed restrict rahegi
      },
    }
  );
}

export const worker = globalForRedis.whatsappWorker;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
