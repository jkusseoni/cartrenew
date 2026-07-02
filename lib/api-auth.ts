import { timingSafeEqual } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/** Constant-time comparison so the secret cannot be brute-forced via timing. */
function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

/**
 * Extracts the automation secret from the places cron/webhook systems can
 * realistically put it:
 *  - `x-admin-secret` header (preferred)
 *  - `Authorization: Bearer <secret>` header (Vercel Cron style)
 *  - `?admin_secret=` or `?secret=` query param (systems that cannot set headers)
 */
function getProvidedAutomationSecret(req: Request): string | null {
  const headerSecret = req.headers.get("x-admin-secret");
  if (headerSecret) return headerSecret;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() || null;
  }

  try {
    const url = new URL(req.url);
    return url.searchParams.get("admin_secret") || url.searchParams.get("secret");
  } catch {
    return null;
  }
}

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
  if (adminSecret && providedSecret && secretsMatch(providedSecret, adminSecret)) {
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

/**
 * Guard for automation/webhook routes hit by cron systems and server-to-server
 * callers (no Clerk session available). Accepts ADMIN_PROCESS_SECRET via the
 * `x-admin-secret` header, an `Authorization: Bearer` header, or an
 * `admin_secret`/`secret` query param. A signed-in Clerk user is also accepted
 * so dashboard-triggered calls keep working.
 *
 * Returns a response to short-circuit with (401/500), or null when authorized.
 */
export async function requireAutomationSecret(req: Request): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === "development") {
    return null;
  }

  const adminSecret = process.env.ADMIN_PROCESS_SECRET?.trim();

  if (!adminSecret) {
    // Fail closed: without a configured secret this route would be wide open.
    console.error(
      "[api-auth] ADMIN_PROCESS_SECRET is not configured — rejecting automation request."
    );
    return NextResponse.json(
      { error: "Automation secret is not configured on the server." },
      { status: 500 }
    );
  }

  const providedSecret = getProvidedAutomationSecret(req);
  if (providedSecret && secretsMatch(providedSecret, adminSecret)) {
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
