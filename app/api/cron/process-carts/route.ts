export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const maxDuration = 60;

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Must match the Prisma Cart.status default ("ABANDONED") — the previous
// lowercase value meant the cron scanned zero carts in production.
const ABANDONED_STATUS = "ABANDONED";

// Cap per run so a large backlog cannot exceed the 60s function budget.
const MAX_CARTS_PER_RUN = 25;

type CartProcessResult = {
  cartId: string;
  status: "processed" | "skipped" | "failed";
  message?: string;
  model?: string;
  error?: string;
  reason?: string;
};

export async function GET(request: NextRequest) {
  const unauthorizedResponse = authorizeCronRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const startedAt = Date.now();
  const results: CartProcessResult[] = [];

  try {
    const { prisma } = await import("@/lib/prisma");
    const { generateCartRecoveryMessageForCartId } = await import("@/lib/cartRecoveryMessage");

    const abandonedCarts = await prisma.cart.findMany({
      where: {
        status: ABANDONED_STATUS,
        notified: false,
      },
      orderBy: {
        updatedAt: "asc",
      },
      // Only the id is needed here; full rows are re-checked atomically below.
      select: { id: true },
      take: MAX_CARTS_PER_RUN,
    });

    for (const cart of abandonedCarts) {
      // Atomic claim: updateMany with the status/notified condition replaces the
      // old findUnique-then-update pattern (removes the N+1 read and the race
      // window between check and update).
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
        const recovery = await generateCartRecoveryMessageForCartId(cart.id);

        results.push({
          cartId: cart.id,
          status: "processed",
          message: recovery.message,
          model: recovery.model,
        });
      } catch (error) {
        console.error(`Cron cart processing failed for cart ${cart.id}:`, error);

        // Release the claim so the next cron run can retry this cart.
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
    const skipped = results.filter((result) => result.status === "skipped").length;
    const failed = results.filter((result) => result.status === "failed").length;

    return NextResponse.json({
      success: failed === 0,
      scanned: abandonedCarts.length,
      processed,
      skipped,
      failed,
      durationMs: Date.now() - startedAt,
      results,
    });
  } catch (error) {
    console.error("Cron cart processing route error:", error);

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
  return error instanceof Error ? error.message : "Unknown error";
}
