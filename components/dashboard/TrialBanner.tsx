"use client";

import Link from "next/link";

import type { PlanType } from "@/lib/billing/trial-config";
import { pricingTablePath } from "@/lib/billing/trial-config";

type TrialBannerProps = {
  planType: PlanType;
  daysRemaining: number;
  planLabel: string;
  locale?: string;
};

export default function TrialBanner({
  planType,
  daysRemaining,
  planLabel,
  locale = "en",
}: TrialBannerProps) {
  if (planType === "trial") {
    return (
      <div className="w-full shrink-0 border-b border-amber-900/40 bg-gradient-to-r from-amber-950/80 via-neutral-950 to-amber-950/80 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <p className="text-xs font-bold text-amber-100 sm:text-sm">
            You are on a{" "}
            <span className="text-[#00DF89]">14-Day Free Trial</span>.{" "}
            <span className="font-mono text-white">{daysRemaining}</span>{" "}
            {daysRemaining === 1 ? "Day" : "Days"} Remaining.
          </p>
          <Link
            href={pricingTablePath(locale)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#00DF89] to-[#00D1FF] px-4 py-1.5 text-[11px] font-black uppercase tracking-wide text-neutral-950 transition-opacity hover:opacity-90"
          >
            Upgrade now
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full shrink-0 border-b border-emerald-900/40 bg-gradient-to-r from-emerald-950/80 via-neutral-950 to-emerald-950/80 px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-xs font-bold text-emerald-100 sm:text-sm">
          Active subscription:{" "}
          <span className="text-[#00DF89]">{planLabel}</span>.{" "}
          <span className="text-neutral-300">Store recovery automation is fully enabled.</span>
        </p>
        <Link
          href={pricingTablePath(locale)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 py-1.5 text-[11px] font-black uppercase tracking-wide text-[#00DF89] transition-colors hover:bg-emerald-950/70"
        >
          Manage plan
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
