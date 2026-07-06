export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ABANDONED_STATUS = "ABANDONED";
const MAX_CARTS_PER_RUN = 25;

type CartProcessResult = {
  cartId: string;
  status: "processed" | "skipped" | "failed";
  message?: string;
  error?: string;
  reason?: string;
};

export async function GET(request: NextRequest) {
  // 1. सिक्योरिटी (Cron Secret) को वापस चालू करें
  const unauthorizedResponse = authorizeCronRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const startedAt = Date.now();
  const results: CartProcessResult[] = [];

  try {
    const { prisma } = await import("@/lib/prisma");
    const { generateCartRecoveryMessageForCartId } = await import("@/lib/cartRecoveryMessage");

    // डेटाबेस से सही तरीके से लेट (let) वेरिएबल्स में कार्ट्स निकालें
    const abandonedCarts = await prisma.cart.findMany({ 
      where: {
        status: ABANDONED_STATUS,
        notified: false,
      },
      orderBy: {
        updatedAt: "asc",
      },
      select: { id: true },
      take: MAX_CARTS_PER_RUN,
    });

    for (const cart of abandonedCarts) {
      const claimed = await prisma.cart.updateMany({
        where: {
          id: cart.id,
          status: ABANDONED_STATUS,
          notified: false,
        },
        data: { notified: true },
      });

      if (claimed.count === 0) {
        results.push({
          cartId: cart.id,
          status: "skipped",
          reason: "cart_already_processed_or_changed",
        });
        continue;
      }

      try {
        // AI message generate karega aur lib/bullmq.ts ke whatsappQueue me job push karega
        const recovery = await generateCartRecoveryMessageForCartId(cart.id);

        results.push({
          cartId: cart.id,
          status: "processed",
          message: recovery.message,
        });
      } catch (error) {
        console.error(`Failed to queue job for cart ${cart.id}:`, error);

        try {
          await prisma.cart.update({
            where: { id: cart.id },
            data: { notified: false },
          });
        } catch (releaseError) {
          console.error(`Failed to release claim for cart ${cart.id}:`, releaseError);
        }

        results.push({
          cartId: cart.id,
          status: "failed",
          error: getErrorMessage(error),
        });
      }
    }

    const processed = results.filter((result) => result.status === "processed").length;
    const failed = results.filter((result) => result.status === "failed").length;

    return NextResponse.json({
      success: failed === 0,
      message: processed > 0 ? "Jobs successfully queued!" : "No abandoned carts to process",
      scanned: abandonedCarts.length,
      processed,
      skipped: results.filter((result) => result.status === "skipped").length,
      failed,
      durationMs: Date.now() - startedAt,
      results,
    });
  } catch (error) {
    console.error("Cart recovery cron route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}

function authorizeCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret && process.env.NODE_ENV !== "production") {
    return null;
  }

  if (!cronSecret) {
    return NextResponse.json(
      {
        success: false,
        error: "CRON_SECRET is not configured.",
      },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  return null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}