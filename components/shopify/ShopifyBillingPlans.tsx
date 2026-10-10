"use client";

import { useState } from "react";

import { brand } from "@/lib/brand";
import { authFetch } from "@/lib/shopify/authFetch";
import {
  SHOPIFY_BILLING_PLANS,
  type ShopifyBillingPlanId,
} from "@/lib/shopify/billing";

type Props = {
  shop: string;
  host?: string;
  currentPlan?: string | null;
  billingStatus?: string | null;
  /** Store install is not confirmed yet — plans stay disabled until it is. */
  setupPending?: boolean;
  onRetrySetup?: () => void;
};

const PLAN_ORDER: ShopifyBillingPlanId[] = ["starter", "growth", "scale"];

export default function ShopifyBillingPlans({
  shop,
  host,
  currentPlan,
  billingStatus,
  setupPending = false,
  onRetrySetup,
}: Props) {
  const [loadingPlan, setLoadingPlan] = useState<ShopifyBillingPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isActive = (billingStatus ?? "").toLowerCase() === "active";

  const startSubscription = async (planId: ShopifyBillingPlanId) => {
    setError(null);
    setLoadingPlan(planId);

    try {
      const res = await authFetch("/api/app/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, host, shop }),
      });

      const data = (await res.json()) as { confirmationUrl?: string; error?: string };

      if (!res.ok || !data.confirmationUrl) {
        throw new Error(data.error || "Could not create Shopify subscription");
      }

      // App Bridge intercepts open(url, "_top") and moves the whole Admin page
      // to Shopify's charge approval screen.
      window.open(data.confirmationUrl, "_top");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Billing request failed");
      setLoadingPlan(null);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Shopify Billing</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Monthly subscriptions are charged through Shopify. Approve the charge in Admin to
            activate your plan
            {isActive && currentPlan ? (
              <>
                {" "}
                · Current:{" "}
                <span className="font-mono text-[#00DF89]">{currentPlan.toUpperCase()}</span>
              </>
            ) : null}
            .
          </p>
        </div>
        {billingStatus ? (
          <span className="inline-flex w-fit rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-300">
            {billingStatus}
          </span>
        ) : null}
      </div>

      {setupPending ? (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black text-amber-300">Finishing setup</p>
            <p className="mt-1 text-xs text-amber-200/80">
              {brand.name} is still connecting to your store. Plans unlock as soon as setup
              completes.
            </p>
          </div>
          {onRetrySetup ? (
            <button
              type="button"
              onClick={onRetrySetup}
              className="w-fit rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-neutral-950 transition hover:bg-amber-300"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-900/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = SHOPIFY_BILLING_PLANS[planId];
          const selected = currentPlan === planId && isActive;
          const busy = loadingPlan === planId;

          return (
            <div
              key={planId}
              className={`flex flex-col rounded-2xl border p-5 ${
                selected
                  ? "border-emerald-700/50 bg-emerald-950/20"
                  : "border-neutral-800 bg-neutral-900/40"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-wider text-neutral-400">
                {plan.label}
              </p>
              <p className="mt-2 text-3xl font-black text-white">
                ${plan.amount}
                <span className="text-sm font-bold text-neutral-500">/mo</span>
              </p>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-neutral-400">
                {plan.description}
              </p>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {plan.trialDays}-day free trial
              </p>
              <button
                type="button"
                disabled={busy || selected || setupPending}
                onClick={() => void startSubscription(planId)}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {selected
                  ? "Current Plan"
                  : busy
                    ? "Redirecting…"
                    : setupPending
                      ? "Finishing setup…"
                      : "Subscribe via Shopify"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
