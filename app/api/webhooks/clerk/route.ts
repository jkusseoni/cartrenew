export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ClerkWebhookPayload = {
  type?: string;
  data?: ClerkUserData;
};

type ClerkUserData = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: ClerkEmailAddress[];
};

type ClerkEmailAddress = {
  id?: string;
  email_address?: string;
};

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    // Verify the Svix signature when a signing secret is configured; otherwise
    // anyone could POST fake user.created events and seed users.
    const verificationError = verifyClerkSignature(req, rawBody);
    if (verificationError) {
      return verificationError;
    }

    let payload: ClerkWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as ClerkWebhookPayload;
    } catch {
      return NextResponse.json(
        { success: false, error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    if (payload.type !== "user.created") {
      return NextResponse.json(
        {
          success: true,
          message: "Webhook event ignored",
          eventType: payload.type ?? "unknown",
        },
        { status: 200 }
      );
    }

    const userData = payload.data;
    const userId = userData?.id;
    const email = getPrimaryEmailAddress(userData);

    if (!userId || !email) {
      return NextResponse.json(
        {
          success: false,
          error: "Clerk user.created payload is missing user id or primary email",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.upsert({
      where: {
        id: userId,
      },
      create: {
        id: userId,
        email,
        firstName: userData?.first_name ?? null,
        lastName: userData?.last_name ?? null,
      },
      update: {
        email,
        firstName: userData?.first_name ?? null,
        lastName: userData?.last_name ?? null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "User synchronized successfully",
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Clerk webhook sync error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Sync Error",
      },
      { status: 500 }
    );
  }
}

/**
 * Verifies the Svix webhook signature Clerk sends (svix-id/svix-timestamp/svix-signature).
 * Enforced only when CLERK_WEBHOOK_SIGNING_SECRET (whsec_...) is configured,
 * so environments without the secret keep working (with a loud warning).
 */
function verifyClerkSignature(req: Request, rawBody: string): NextResponse | null {
  const signingSecret =
    process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim() || process.env.CLERK_WEBHOOK_SECRET?.trim();

  if (!signingSecret) {
    console.warn(
      "[clerk-webhook] CLERK_WEBHOOK_SIGNING_SECRET not set — skipping signature verification."
    );
    return null;
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { success: false, error: "Missing Svix signature headers" },
      { status: 401 }
    );
  }

  try {
    // Svix scheme: HMAC-SHA256 over "{id}.{timestamp}.{body}" keyed with the
    // base64-decoded secret (after the "whsec_" prefix).
    const secretBytes = Buffer.from(signingSecret.replace(/^whsec_/, ""), "base64");
    const expected = createHmac("sha256", secretBytes)
      .update(`${svixId}.${svixTimestamp}.${rawBody}`)
      .digest("base64");

    // Header may contain multiple space-separated "v1,<sig>" entries.
    const signatureMatches = svixSignature.split(" ").some((entry) => {
      const candidate = entry.split(",")[1] ?? entry;
      const candidateBuffer = Buffer.from(candidate, "base64");
      const expectedBuffer = Buffer.from(expected, "base64");
      return (
        candidateBuffer.length === expectedBuffer.length &&
        timingSafeEqual(candidateBuffer, expectedBuffer)
      );
    });

    if (!signatureMatches) {
      return NextResponse.json({ success: false, error: "Invalid webhook signature" }, { status: 401 });
    }

    return null;
  } catch (error) {
    console.error("Clerk webhook signature verification failed:", error);
    return NextResponse.json(
      { success: false, error: "Signature verification failed" },
      { status: 401 }
    );
  }
}

function getPrimaryEmailAddress(userData: ClerkUserData | undefined) {
  const emailAddresses = userData?.email_addresses ?? [];
  const primaryEmail = emailAddresses.find(
    (emailAddress) => emailAddress.id === userData?.primary_email_address_id
  );

  return primaryEmail?.email_address ?? emailAddresses[0]?.email_address;
}
