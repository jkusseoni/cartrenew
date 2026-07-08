"use client";

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
  const dashboardHref = `/${locale}/dashboard`;

  const plans = useMemo(() => {
    // 🎨 Light Theme Accents
    const standardAccent = "border-slate-200 bg-white/60 backdrop-blur-sm hover:shadow-lg hover:border-blue-200/50";
    const popularAccent = "border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white/80 shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-500/10 scale-[1.02]";

    return {
      monthly: {
        india: [
          {
            id: "in-starter",
            name: "Starter",
            price: "₹999",
            cadence: "/month",
            checkoutUrl: "https://rzp.io/rzp/Vb031St",
            cta: "Choose Starter",
            accent: standardAccent,
            features: ["1 Store", "200 Cart Recoveries / month", "WhatsApp + Email", "Basic Dashboard", "0% Conversation Markup"],
          },
          {
            id: "in-growth",
            name: "Growth",
            price: "₹2,499",
            cadence: "/month",
            checkoutUrl: "https://rzp.io/rzp/nhwzQWQd",
            cta: "Select Growth",
            accent: popularAccent,
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
            accent: standardAccent,
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
            cta: "Choose Starter",
            accent: standardAccent,
            features: ["1 Store", "200 Cart Recoveries / month", "WhatsApp + Email", "Basic Dashboard", "0% Conversation Markup"],
          },
          {
            id: "gl-growth",
            name: "Growth",
            price: "$29",
            cadence: "/month",
            checkoutUrl: "https://www.paypal.com/ncp/payment/WL25MJXGDVEEG",
            cta: "Select Growth",
            accent: popularAccent,
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
            accent: standardAccent,
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
            checkoutUrl: "https://rzp.io/rzp/6LhjxROW",
            cta: "Get Lifetime Access",
            accent: standardAccent,
            features: ["1 Storefront integration", "Up to 500 automated recovery sessions/mo", "Dynamic multi-lingual routing", "Vercel & Supabase edge latency handling", "Email support via contact@cartrenew.com"],
          },
          {
            id: "ltd-growth",
            name: "Growth LTD",
            price: "₹18,896",
            cadence: "/one-time",
            checkoutUrl: "https://rzp.io/rzp/pU7Y7xTj",
            cta: "Secure Lifetime Access",
            accent: popularAccent,
            highlight: "MOST_POPULAR" as const,
            features: ["3 Storefront integrations", "Unlimited recovery sessions", "Priority AI WhatsApp personalization", "Advanced cross-border analytics dashboard", "24/7 Priority developer support", "Lifetime system core updates"],
          },
          {
            id: "ltd-agency",
            name: "Agency LTD",
            price: "₹37,885",
            cadence: "/one-time",
            checkoutUrl: "https://rzp.io/rzp/emdA9Lmk",
            cta: "Deploy Agency Infrastructure",
            accent: standardAccent,
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
            accent: standardAccent,
            features: ["1 Storefront integration", "Up to 500 automated recovery sessions/mo", "Dynamic multi-lingual routing", "Vercel & Supabase edge latency handling", "Email support via contact@cartrenew.com"],
          },
          {
            id: "ltd-growth",
            name: "Growth LTD",
            price: "$199",
            cadence: "/one-time",
            checkoutUrl: "https://www.paypal.com/ncp/payment/E52ENNY2BJH5U",
            cta: "Secure Lifetime Access",
            accent: popularAccent,
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
            accent: standardAccent,
            highlight: "BEST_VALUE" as const,
            features: ["Unlimited storefront integrations", "Unlimited recovery sessions", "Full white-label branding configurations", "Dedicated database cluster allocations", "Direct WhatsApp API infrastructure link", "Dedicated partner manager access"],
          },
        ],
      },
    };
  }, []);

  const market: Market = currency === "INR" ? "india" : "global";
  const activePlans = plans[billing][market];

  const handlePlanCheckout = (plan: Plan) => {
    if (!plan.checkoutUrl) {
      window.location.href = dashboardHref;
      return;
    }
    window.open(plan.checkoutUrl, "_blank", "noopener,noreferrer");
  };

  const ctaClassName = (highlight?: Plan["highlight"]) =>
    `w-full py-3.5 text-center text-xs font-black rounded-xl transition-all block active:scale-[0.98] ${
      highlight === "MOST_POPULAR"
        ? "bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-500 text-white hover:opacity-90 shadow-md shadow-blue-500/10"
        : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-sm"
    }`;

  return (
    // 🌸 Transparent background since the parent layout handles the glowing light colors
    <section id="trial" className="w-full bg-transparent text-slate-900 py-20 px-4 sm:px-6 lg:px-8 relative z-10">
      <div id="pricing" className="absolute -top-20" />

      <div className="max-w-7xl mx-auto flex flex-col items-center space-y-12 text-center">
        <div className="max-w-3xl space-y-4">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight text-slate-900">
            Predictable tiers.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-500">
              Zero Variable Markup Surprises
            </span>
            .
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto font-medium">
            Choose the operational architecture that scales your store volume. All plans directly tunnel Meta&apos;s base cloud conversation charges without adding commissions.
          </p>
        </div>

        {/* MASTER SWITCHER TOOLBAR - Light Glassmorphism */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-2 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 shadow-sm relative z-10">
          
          {/* TOGGLE 1: Monthly vs Lifetime */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-50 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`px-5 py-2 rounded-lg text-xs font-black transition-all duration-200 ${billing === "monthly" ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
            >
              🗓️ Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("lifetime")}
              className={`px-5 py-2 rounded-lg text-xs font-black transition-all duration-200 ${billing === "lifetime" ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}
            >
              💎 Lifetime
            </button>
          </div>

          {/* TOGGLE 2: Global merchant currency */}
          <div className="flex flex-wrap items-center justify-center gap-1 p-1 rounded-xl bg-slate-50 border border-slate-200/60">
            {currencyOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => setCurrency(option.code)}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all duration-200 ${
                  currency === option.code
                    ? "bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-md"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONSOLIDATED MATRIX GRID */}
        <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch pt-4 text-left">
          {activePlans.map((plan) => (
            <div key={plan.id} className={`border rounded-3xl p-6 flex flex-col justify-between space-y-8 relative group transition-all duration-300 ${plan.accent}`}>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase font-black tracking-widest text-slate-500">{plan.name}</span>
                  {plan.highlight && (
                    <span className={`text-[9px] font-black tracking-wider uppercase px-2 py-1 rounded-md border ${plan.highlight === "MOST_POPULAR" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                      {plan.highlight.replace("_", " ")}
                    </span>
                  )}
                </div>
                <div className="pt-1">
                  <p className="text-3xl font-mono font-black text-slate-900">
                    {formatPlanPrice(plan, currency)}
                    <span className="text-xs font-bold text-slate-400 font-sans ml-1">{plan.cadence}</span>
                  </p>
                </div>
                <ul className="space-y-3 pt-6 text-xs font-bold text-slate-600 border-t border-slate-100">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" strokeWidth={3} />
                      <span className="leading-tight">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => handlePlanCheckout(plan)}
                className={ctaClassName(plan.highlight)}
              >
                {plan.cta}
              </button>
            </div>
          ))}
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