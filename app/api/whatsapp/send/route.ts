export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendRecoveryMessage } from "@/lib/whatsapp";

/**
 * POST /api/whatsapp/send
 * Dashboard checkout recovery request handler
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, customerName, cartUrl, totalAmount } = body;

    // Standard validation checking
    if (!phone || !customerName || !cartUrl || totalAmount === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters (phone, customerName, cartUrl, totalAmount)" },
        { status: 400 }
      );
    }

    // Call the dynamic Hinglish engine we built in lib
    const result = await sendRecoveryMessage(phone, customerName, cartUrl, Number(totalAmount));

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to route message pipeline" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "WhatsApp recovery sequence logged and processed successfully",
      messageId: result.messageId,
    });

  } catch (error) {
    console.error("❌ API Route Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}