"use client";

import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";

type LifetimeDealTier = "SINGLE" | "DOUBLE" | "MULTIPLE";

type PricingTier = {
  accentClass: string;
  audience: string;
  checkoutUrl: string;
  cta: string;
  description: string;
  features: string[];
  highlighted: boolean;
  key: LifetimeDealTier;
  name: string;
  price: string;
  tag: string;
};

const RAZORPAY_CHECKOUT_URLS: Record<LifetimeDealTier, string> = {
  SINGLE: "https://rzp.io/rzp/6LhjxROW",     // Starter LTD ($99)
  DOUBLE: "https://rzp.io/rzp/pU7Y7xTj",   // Growth LTD ($199)
  MULTIPLE: "https://rzp.io/rzp/emdA9Lmk", // Agency LTD ($399)
};

const pricingTiers: PricingTier[] = [
  {
    accentClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    audience: "Solo operators",
    checkoutUrl: RAZORPAY_CHECKOUT_URLS.SINGLE,
    cta: "Claim Single LTD",
    description: "A focused launch tier for one store with core recovery automation.",
    features: [
      "1 connected store",
      "500 recovery events per month",
      "WhatsApp and email recovery flows",
      "AI recovery message generation",
    ],
    highlighted: false,
    key: "SINGLE",
    name: "Single",
    price: "$59",
    tag: "Starter",
  },
  {
    accentClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
    audience: "Growing merchants",
    checkoutUrl: RAZORPAY_CHECKOUT_URLS.DOUBLE,
    cta: "Claim Double LTD",
    description: "The best fit for teams scaling recovery across multiple stores.",
    features: [
      "3 connected stores",
      "2,000 recovery events per month",
      "WhatsApp, email, and SMS channels",
      "Advanced AI personalization controls",
    ],
    highlighted: true,
    key: "DOUBLE",
    name: "Double",
    price: "$118",
    tag: "Most Popular",
  },
  {
    accentClass: "border-slate-300 bg-slate-100 text-slate-800",
    audience: "Agencies and portfolios",
    checkoutUrl: RAZORPAY_CHECKOUT_URLS.MULTIPLE,
    cta: "Claim Multiple LTD",
    description: "Portfolio-grade access for teams managing many storefronts.",
    features: [
      "Unlimited connected stores",
      "Unlimited recovery events",
      "All recovery channels unlocked",
      "Priority implementation support",
    ],
    highlighted: false,
    key: "MULTIPLE",
    name: "Multiple",
    price: "$177",
    tag: "Best Value",
  },
];

export default function Pricing() {
  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
            Lifetime launch pricing
          </span>
          <h2 className="mt-5 text-4xl font-bold text-slate-950 sm:text-5xl">
            Choose your CartRenew LTD tier
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Direct Razorpay Payment Links for the launch offer, mapped by tier.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {pricingTiers.map((tier) => {
            const isConfigured = tier.checkoutUrl.length > 0;

            return (
              <article
                className={`relative flex min-h-full flex-col rounded-lg border bg-white p-6 shadow-sm transition ${
                  tier.highlighted
                    ? "border-indigo-500 shadow-indigo-100 ring-1 ring-indigo-500"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-md"
                }`}
                key={tier.key}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span
                      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${tier.accentClass}`}
                    >
                      {tier.tag}
                    </span>
                    <h3 className="mt-4 text-2xl font-bold text-slate-950">{tier.name}</h3>
                    <p className="mt-2 text-sm font-medium text-slate-500">{tier.audience}</p>
                  </div>
                  {tier.highlighted ? (
                    <span className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white">
                      Popular
                    </span>
                  ) : null}
                </div>

                <div className="mt-6 flex items-end gap-2">
                  <span className="text-5xl font-bold text-slate-950">{tier.price}</span>
                  <span className="pb-2 text-sm font-semibold text-slate-500">one time</span>
                </div>

                <p className="mt-5 min-h-12 text-sm leading-6 text-slate-600">{tier.description}</p>

                <ul className="mt-6 space-y-3">
                  {tier.features.map((feature) => (
                    <li className="flex gap-3 text-sm text-slate-700" key={feature}>
                      <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-1 flex-col justify-end">
                  <a
                    aria-disabled={!isConfigured}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition ${
                      isConfigured
                        ? tier.highlighted
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "bg-slate-950 text-white hover:bg-slate-800"
                        : "pointer-events-none bg-slate-200 text-slate-500"
                    }`}
                    href={isConfigured ? tier.checkoutUrl : "#"}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {isConfigured ? tier.cta : "Payment link pending"}
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mx-auto mt-8 flex max-w-3xl items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600" />
          Secure checkout is handled on Razorpay-hosted payment pages.
        </div>
      </div>
    </section>
  );
}
