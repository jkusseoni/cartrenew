export type LanguageMetric = {
  name: string;
  counts: number;
  revenue: number;
};

export type LiveFeedItem = {
  id: string;
  customerName: string;
  cartValue: number;
  status: string;
  createdAt: string;
  channel: string;
  itemsSummary?: string;
};

export type DashboardAnalyticsPayload = {
  totalAbandoned: number;
  messagesSent: number;
  recoveredRevenue: number;
  recoveredRate: number;
  languageData: LanguageMetric[];
  liveFeed: LiveFeedItem[];
};

export const EMPTY_DASHBOARD_ANALYTICS: DashboardAnalyticsPayload = {
  totalAbandoned: 0,
  messagesSent: 0,
  recoveredRevenue: 0,
  recoveredRate: 0,
  languageData: [],
  liveFeed: [],
};

function getAnalyticsApiUrl(days = 30): string {
  // Prefer same-origin relative URL in the browser so cookies/session stay attached.
  if (typeof window !== "undefined") {
    return `/api/analytics?days=${days}`;
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/analytics?days=${days}`;
}

export async function fetchDashboardAnalytics(
  days = 30
): Promise<DashboardAnalyticsPayload> {
  try {
    const response = await fetch(getAnalyticsApiUrl(days), {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Analytics request failed (${response.status})`);
    }

    const data = (await response.json()) as {
      totals?: {
        totalAbandoned?: number;
        messagesSent?: number;
        recoveredRevenue?: number;
        recoveredRate?: number;
      };
      languageData?: LanguageMetric[];
      liveFeed?: LiveFeedItem[];
    };

    return {
      totalAbandoned: data.totals?.totalAbandoned ?? 0,
      messagesSent: data.totals?.messagesSent ?? 0,
      recoveredRevenue: data.totals?.recoveredRevenue ?? 0,
      recoveredRate: data.totals?.recoveredRate ?? 0,
      languageData: data.languageData ?? [],
      liveFeed: data.liveFeed ?? [],
    };
  } catch (error) {
    console.warn("Dashboard analytics fetch failed:", error);
    return EMPTY_DASHBOARD_ANALYTICS;
  }
}

export function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatRelativeTime(isoDate: string): string {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) {
    return "—";
  }

  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatCartStatus(status: string): string {
  switch (status.toUpperCase()) {
    case "RECOVERED":
      return "Recovered";
    case "AI_SENT":
    case "MESSAGED":
      return "AI Sent";
    case "SMS_FALLBACK":
      return "SMS Fallback";
    case "ABANDONED":
    case "PENDING":
      return "Abandoned";
    case "LOST":
      return "Lost";
    default:
      return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

export function formatCartChannel(channel: string): string {
  switch (channel.toUpperCase()) {
    case "WHATSAPP":
      return "WhatsApp AI";
    case "SMS_FALLBACK":
      return "Backup SMS";
    case "SMS":
      return "Backup SMS";
    default:
      return channel.replace(/_/g, " ");
  }
}

export function getStatusBadgeClass(status: string): string {
  const normalized = status.toUpperCase();

  if (normalized === "RECOVERED") {
    return "bg-emerald-950/40 text-[#00DF89] border border-emerald-900/30";
  }
  if (normalized === "AI_SENT" || normalized === "MESSAGED") {
    return "bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 animate-pulse";
  }
  if (normalized === "SMS_FALLBACK" || normalized === "SMS") {
    return "bg-amber-950/40 text-amber-400 border border-amber-900/30";
  }

  return "bg-neutral-900 text-neutral-500 border border-neutral-800";
}
