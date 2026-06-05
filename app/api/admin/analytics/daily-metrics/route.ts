export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Mock analytics data for local development
    // In production, this would aggregate from your analytics database
    const mockAnalytics = {
      recoveredToday: 24,
      recoveryRate: 14.5,
      savedRevenue: 24500,
    }

    return NextResponse.json(mockAnalytics)
  } catch (error) {
    console.error('Analytics fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
