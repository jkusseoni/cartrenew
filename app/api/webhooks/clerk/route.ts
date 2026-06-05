export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const payload = (await req.json()) as ClerkWebhookPayload;

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

function getPrimaryEmailAddress(userData: ClerkUserData | undefined) {
  const emailAddresses = userData?.email_addresses ?? [];
  const primaryEmail = emailAddresses.find(
    (emailAddress) => emailAddress.id === userData?.primary_email_address_id
  );

  return primaryEmail?.email_address ?? emailAddresses[0]?.email_address;
}
