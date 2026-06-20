"use client";

import Link from "next/link";

import { pricingTablePath, STARTER_TIER } from "@/lib/billing/trial-config";

type TrialExpiredModalProps = {
  locale?: string;
  reason?: string;
};

export default function TrialExpiredModal({
  locale = "en",
  reason = "Your 14-day trial has ended. Upgrade to restore store recovery operations.",
}: TrialExpiredModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
        <div className="mb-4 inline-flex rounded-full border border-rose-900/40 bg-rose-950/30 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-rose-400">
          Recovery operations locked
        </div>
        <h2 id="trial-expired-title" className="text-xl font-black text-white tracking-tight">
          Trial expired
        </h2>
        <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{reason}</p>
        <p className="mt-3 text-xs text-neutral-500">
          Store recovery webhooks and automation flows are paused until you activate a paid
          subscription.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href={pricingTablePath(locale)}
            className="flex-1 rounded-xl bg-gradient-to-r from-[#00DF89] to-[#00D1FF] py-3 text-center text-xs font-black uppercase tracking-wide text-neutral-950 transition-opacity hover:opacity-90"
          >
            View ${STARTER_TIER.priceUsd}/mo Starter plan
          </Link>
          <a
            href={STARTER_TIER.paypalCheckoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900/60 py-3 text-center text-xs font-black uppercase tracking-wide text-white transition-colors hover:bg-neutral-900"
          >
            Pay with PayPal
          </a>
        </div>
      </div>
    </div>
  );
}
