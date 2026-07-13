import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@/lib/prisma';

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

// 3. Singleton Worker: Background me real-time WhatsApp deliveries handle karne ke liye
if (!globalForRedis.whatsappWorker) {
  globalForRedis.whatsappWorker = new Worker(
    'WhatsAppRecovery',
    async (job) => {
      const { cartId, phoneNumber, messagePayload } = job.data;
      console.log(`🚀 [BullMQ] Job ${job.id} started for Cart ID: ${cartId}`);

      try {
        if (!phoneNumber) {
          throw new Error('WhatsAppRecovery job missing phoneNumber');
        }

        const textMessage =
          typeof messagePayload?.text === 'string'
            ? messagePayload.text
            : typeof messagePayload === 'string'
              ? messagePayload
              : '';

        if (!textMessage) {
          throw new Error('WhatsAppRecovery job missing messagePayload.text');
        }

        // Prefer Twilio when configured, then Meta Cloud API — same router as messaging.ts.
        const { sendMessage } = await import('@/lib/services/provider');
        const result = await sendMessage({
          id: String(job.id ?? cartId ?? 'whatsapp-recovery'),
          to: phoneNumber,
          body: textMessage,
          templateName:
            typeof messagePayload?.templateName === 'string'
              ? messagePayload.templateName
              : undefined,
        });

        if (!result.success) {
          console.error(`❌ [BullMQ] WhatsApp provider error for Job ${job.id}:`, result.error);
          throw new Error(result.error || 'WhatsApp provider request failed');
        }

        const messageId = result.providerId;
        console.log(
          `📥 [BullMQ] Message dispatched via ${result.provider ?? 'provider'}. ID: ${messageId}`
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
        console.error(
          `💥 [BullMQ] Delivery execution failed for job ${job.id}:`,
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    },
    {
      connection: bullMqConnection,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );
}

export const worker = globalForRedis.whatsappWorker;
