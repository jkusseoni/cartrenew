import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Shared guard for admin-only API routes.
 *
 * Allows the request when any of these hold:
 *  - development mode (local testing)
 *  - a valid `x-admin-secret` header matching ADMIN_PROCESS_SECRET (server-to-server)
 *  - a signed-in Clerk user (dashboard clients)
 *
 * Returns a 401 response to short-circuit with, or null when authorized.
 */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === "development") {
    return null;
  }

  const adminSecret = process.env.ADMIN_PROCESS_SECRET?.trim();
  const providedSecret = req.headers.get("x-admin-secret");
  if (adminSecret && providedSecret === adminSecret) {
    return null;
  }

  try {
    const { userId } = await auth();
    if (userId) {
      return null;
    }
  } catch {
    // Clerk unavailable (e.g. missing keys) — fall through to 401.
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Parses a JSON request body without throwing on malformed input. */
export async function safeParseBody<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
