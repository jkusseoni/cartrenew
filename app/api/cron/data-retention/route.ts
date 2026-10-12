import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { retentionErrorCode, runDataRetention } from "@/lib/privacy/retention-run"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

/**
 * GET /api/cron/data-retention — daily Vercel cron (see vercel.json).
 * RETENTION_DRY_RUN defaults to on. Counts only; no contact fields are logged.
 */
export async function GET(request: NextRequest) {
  const unauthorized = authorizeCron(request)
  if (unauthorized) return unauthorized

  try {
    const counts = await runDataRetention()
    console.info("[data-retention]", counts)
    return NextResponse.json({ success: true, ...counts })
  } catch (error) {
    console.error("[data-retention] failed", { code: retentionErrorCode(error) })
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

function authorizeCron(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret && process.env.NODE_ENV !== "production") return null
  if (!cronSecret) {
    return NextResponse.json({ success: false, error: "CRON_SECRET is not configured." }, { status: 500 })
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  return null
}
