"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import { Check } from "lucide-react";

import { type Currency, useMarketSettings } from "@/context/MarketSettingsContext";

type Market = "india" | "global";
type BillingCycle = "monthly" | "lifetime";

type Plan = {
  id: string;
  name: string;
  price: string;
  cadence: string;
  features: string[];
  cta: string;
  accent: string;
  highlight?: "MOST_POPULAR" | "BEST_VALUE";
  checkoutUrl: string;
};

const currencyOptions: Array<{ code: Currency; label: string }> = [
  { code: "USD", label: "USD $" },
  { code: "INR", label: "INR ₹" },
];

const currencyRatesFromUsd: Record<Currency, number> = {
  AED: 3.67,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83,
  USD: 1,
};

export default function PricingTable() {
  const { currency, setCurrency } = useMarketSettings();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "en";
  const signUpHref = `/${locale}/sign-up`;

  const plans = useMemo(() => {
    return {
      monthly: {
        india: [
          {
            id: "in-starter",
            name: "Starter",
            price: "₹999",
            cadence: "/month",
            checkoutUrl: "https://rzp.io/rzp/Vb031St",
            cta: "Start 14-Day Free Trial",
            accent: "border-neutral-800 bg-neutral-900/40",
            features: ["1 Store", "200 Cart Recoveries / month", "WhatsApp + Email", "Basic Dashboard", "0% Conversation Markup", "14-day Free Trial"],
          },
          {
            id: "in-growth",
            name: "Growth",
            price: "₹2,499",
            cadence: "/month",
            checkoutUrl: "https://rzp.io/rzp/nhwzQWQd",
            cta: "Start 14-Day Free Trial",
            accent: "border-emerald-500/50 bg-neutral-950/60 shadow-2xl",
            highlight: "MOST_POPULAR" as const,
            features: ["3 Stores", "1,000 Cart Recoveries / month", "WhatsApp + Email + SMS", "AI Personalized Messages", "0% Conversation Markup", "COD Verification"],
          },
          {
            id: "in-scale",
            name: "Scale",
            price: "₹5,999",
            cadence: "/month",
            checkoutUrl: "https://rzp.io/rzp/soM2kxu",
            cta: "Go Scale Now",
            accent: "border-neutral-800 bg-neutral-900/40",
            highlight: "BEST_VALUE" as const,
            features: ["Unlimited Stores", "Unlimited Recoveries", "All Channels", "AI Chatbot", "Shiprocket Integration", "Priority Support", "Custom Templates", "White Label Option"],
          },
        ],
        global: [
          {
            id: "gl-starter",
            name: "Starter",
            price: "$12",
            cadence: "/month",
            checkoutUrl: "https://www.paypal.com/ncp/payment/Y8MTCQRFMU82G",
            cta: "Start 14-Day Free Trial",
            accent: "border-neutral-800 bg-neutral-900/40",
            features: ["1 Store", "200 Cart Recoveries / month", "WhatsApp + Email", "Basic Dashboard", "0% Conversation Markup"],
          },
          {
            id: "gl-growth",
            name: "Growth",
            price: "$29",
            cadence: "/month",
            checkoutUrl: "https://www.paypal.com/ncp/payment/WL25MJXGDVEEG",
            cta: "Start 14-Day Free Trial",
            accent: "border-emerald-500/50 bg-neutral-950/60 shadow-2xl",
            highlight: "MOST_POPULAR" as const,
            features: ["3 Stores", "1,000 Cart Recoveries / month", "WhatsApp + Email + SMS", "AI Personalized Messages", "0% Conversation Markup"],
          },
          {
            id: "gl-scale",
            name: "Scale",
            price: "$69",
            cadence: "/month",
            checkoutUrl: "https://www.paypal.com/ncp/payment/ZMSWX6S3MUGU4",
            cta: "Go Scale Now",
            accent: "border-neutral-800 bg-neutral-900/40",
            highlight: "BEST_VALUE" as const,
            features: ["Unlimited Stores", "Unlimited Recoveries", "All Channels", "AI Chatbot", "Priority Support", "White Label Option"],
          },
        ],
      },
      lifetime: {
        india: [
          {
            id: "ltd-starter",
            name: "Starter LTD",
            price: "₹9,400",
            cadence: "/one-time",
            checkoutUrl: "https://rzp.io/rzp/Vb031St",
            cta: "Get Lifetime Access",
            accent: "border-neutral-800 bg-neutral-900/40",
            features: ["1 Storefront integration", "Up to 500 automated recovery sessions/mo", "Dynamic multi-lingual routing", "Vercel & Supabase edge latency handling", "Email support via contact@cartrenew.com"],
          },
          {
            id: "ltd-growth",
            name: "Growth LTD",
            price: "₹18,896",
            cadence: "/one-time",
            checkoutUrl: "https://rzp.io/rzp/nhwzQWQd",
            cta: "Secure Lifetime Access",
            accent: "border-emerald-500/50 bg-neutral-950/60 shadow-2xl",
            highlight: "MOST_POPULAR" as const,
            features: ["3 Storefront integrations", "Unlimited recovery sessions", "Priority AI WhatsApp personalization", "Advanced cross-border analytics dashboard", "24/7 Priority developer support", "Lifetime system core updates"],
          },
          {
            id: "ltd-agency",
            name: "Agency LTD",
            price: "₹37,885",
            cadence: "/one-time",
            checkoutUrl: "https://rzp.io/rzp/soM2kxu",
            cta: "Deploy Agency Infrastructure",
            accent: "border-neutral-800 bg-neutral-900/40",
            highlight: "BEST_VALUE" as const,
            features: ["Unlimited storefront integrations", "Unlimited recovery sessions", "Full white-label branding configurations", "Dedicated database cluster allocations", "Direct WhatsApp API infrastructure link", "Dedicated partner manager access"],
          },
        ],
        global: [
          {
            id: "ltd-starter",
            name: "Starter LTD",
            price: "$99",
            cadence: "/one-time",
            checkoutUrl: "https://www.paypal.com/ncp/payment/RUZ4F22XZCNZU",
            cta: "Get Lifetime Access",
            accent: "border-neutral-800 bg-neutral-900/40",
            features: ["1 Storefront integration", "Up to 500 automated recovery sessions/mo", "Dynamic multi-lingual routing", "Vercel & Supabase edge latency handling", "Email support via contact@cartrenew.com"],
          },
          {
            id: "ltd-growth",
            name: "Growth LTD",
            price: "$199",
            cadence: "/one-time",
            checkoutUrl: "https://www.paypal.com/ncp/payment/E52ENNY2BJH5U",
            cta: "Secure Lifetime Access",
            accent: "border-emerald-500/50 bg-neutral-950/60 shadow-2xl",
            highlight: "MOST_POPULAR" as const,
            features: ["3 Storefront integrations", "Unlimited recovery sessions", "Priority AI WhatsApp personalization", "Advanced cross-border analytics dashboard", "24/7 Priority developer support", "Lifetime system core updates"],
          },
          {
            id: "ltd-agency",
            name: "Agency LTD",
            price: "$399",
            cadence: "/one-time",
            checkoutUrl: "https://www.paypal.com/ncp/payment/JW42UJ2GHHR3A",
            cta: "Deploy Agency Infrastructure",
            accent: "border-neutral-800 bg-neutral-900/40",
            highlight: "BEST_VALUE" as const,
            features: ["Unlimited storefront integrations", "Unlimited recovery sessions", "Full white-label branding configurations", "Dedicated database cluster allocations", "Direct WhatsApp API infrastructure link", "Dedicated partner manager access"],
          },
        ],
      },
    };
  }, []);

  const market: Market = currency === "INR" ? "india" : "global";
  const activePlans = plans[billing][market];

  const ctaClassName = (highlight?: Plan["highlight"]) =>
    `w-full py-3.5 text-center text-xs font-black rounded-xl transition-all block active:scale-[0.98] ${
      highlight === "MOST_POPULAR"
        ? "bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 hover:opacity-95 shadow-md shadow-emerald-500/10"
        : "border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:text-white"
    }`;

  return (
    <section id="trial" className="w-full bg-[#0B0F17] text-white py-20 px-4 sm:px-6 lg:px-8 border-t border-neutral-900/60 relative">
      <div id="pricing" className="absolute -top-20" />

      <div className="max-w-7xl mx-auto flex flex-col items-center space-y-12 text-center">
        <div className="max-w-3xl space-y-4">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            Predictable tiers.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">
              Zero Variable Markup Surprises
            </span>
            .
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl mx-auto">
            Choose the operational architecture that scales your store volume. All plans directly tunnel Meta&apos;s base cloud conversation charges without adding commissions.
          </p>
        </div>

        {/* MASTER SWITCHER TOOLBAR */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-2 rounded-2xl bg-neutral-950 border border-neutral-900/80 shadow-2xl relative z-10">
          {/* TOGGLE 1: Monthly vs Lifetime */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-neutral-900/50 border border-neutral-800/40">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`px-5 py-2 rounded-lg text-xs font-black transition-all duration-200 ${billing === "monthly" ? "bg-neutral-800 text-white shadow-md border border-neutral-700/30" : "text-neutral-500 hover:text-neutral-300"}`}
            >
              🗓️ Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("lifetime")}
              className={`px-5 py-2 rounded-lg text-xs font-black transition-all duration-200 ${billing === "lifetime" ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md" : "text-neutral-500 hover:text-neutral-300"}`}
            >
              💎 Lifetime
            </button>
          </div>

          {/* TOGGLE 2: Global merchant currency */}
          <div className="flex flex-wrap items-center justify-center gap-1 p-1 rounded-xl bg-neutral-900/50 border border-neutral-800/40">
            {currencyOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => setCurrency(option.code)}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all duration-200 ${
                  currency === option.code
                    ? "bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 shadow-md"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONSOLIDATED MATRIX GRID */}
        <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch pt-4 text-left">
          {activePlans.map((plan) => {
            const isTrialPlan =
              billing === "monthly" && /(?:starter|growth)$/.test(plan.id);

            return (
            <div key={plan.id} className={`border rounded-3xl p-6 flex flex-col justify-between space-y-8 relative group transition-all duration-300 ${plan.accent}`}>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase font-black tracking-widest text-neutral-500">{plan.name}</span>
                  {plan.highlight && (
                    <span className={`text-[8px] font-black tracking-wider uppercase px-2 py-0.5 rounded border ${plan.highlight === "MOST_POPULAR" ? "bg-emerald-950/60 text-[#00DF89] border-emerald-500/20" : "bg-cyan-950/60 text-cyan-400 border-cyan-500/20"}`}>
                      {plan.highlight.replace("_", " ")}
                    </span>
                  )}
                </div>
                <div className="pt-1">
                  <p className="text-3xl font-mono font-black text-white">
                    {formatPlanPrice(plan, currency)}
                    <span className="text-xs font-normal text-neutral-500 font-sans">{plan.cadence}</span>
                  </p>
                </div>
                <ul className="space-y-2.5 pt-4 text-xs font-bold text-neutral-300 border-t border-neutral-900/60">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#00DF89] shrink-0 mt-0.5" />
                      <span className="leading-tight">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Trial CTAs route to the localized sign-up; paid tiers go to checkout. */}
              {isTrialPlan ? (
                <Link href={signUpHref} className={ctaClassName(plan.highlight)}>
                  {plan.cta}
                </Link>
              ) : (
                <a
                  href={plan.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ctaClassName(plan.highlight)}
                >
                  {plan.cta}
                </a>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function formatPlanPrice(plan: Plan, currency: Currency) {
  if (currency === "INR") {
    return plan.price;
  }

  const usdAmount = Number(plan.price.replace(/[^0-9.]/g, ""));
  const convertedAmount = usdAmount * currencyRatesFromUsd[currency];

  return new Intl.NumberFormat(currencyToLocale(currency), {
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(convertedAmount);
}

function currencyToLocale(currency: Currency) {
  const locales: Record<Currency, string> = {
    AED: "en-AE",
    EUR: "de-DE",
    GBP: "en-GB",
    INR: "en-IN",
    USD: "en-US",
  };

  return locales[currency];
}