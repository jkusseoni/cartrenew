"use client";

import React, { useState } from 'react';
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";

// 🎯 1. Strict Typing from your original architecture
type LifetimeDealTier = "SINGLE" | "DOUBLE" | "MULTIPLE";

type PricingTier = {
  accentClass: string;
  audience: string;
  cta: string;
  description: string;
  features: string[];
  highlighted: boolean;
  key: LifetimeDealTier;
  name: string;
  priceINR: string;
  priceUSD: string;
  tag: string;
};

// 💳 2. Your Exact Live Razorpay Links from dashboard data
const RAZORPAY_CHECKOUT_URLS: Record<LifetimeDealTier, string> = {
  SINGLE: "https://rzp.io/rzp/6LhjxROW",   // Starter LTD -> ₹9,400
  DOUBLE: "https://rzp.io/rzp/pU7Y7xTj",   // Growth LTD -> ₹18,895
  MULTIPLE: "https://rzp.io/rzp/emdA9Lmk", // Agency LTD -> ₹37,885
};

// 🌐 3. Matching International Stripe Links Mapping
const STRIPE_CHECKOUT_URLS: Record<LifetimeDealTier, string> = {
  SINGLE: "https://buy.stripe.com/test_starter_ltd",
  DOUBLE: "https://buy.stripe.com/test_growth_ltd",
  MULTIPLE: "https://buy.stripe.com/test_agency_ltd"
};

// 📊 4. Full 3-Card Array configured with your real prices
const pricingTiers: PricingTier[] = [
  {
    key: "SINGLE",
    name: "Starter LTD",
    audience: "For early stage e-commerce setups",
    priceINR: "₹9,400",
    priceUSD: "$99",
    description: "Core autonomous cart recovery system with native features.",
    cta: "Start 14-Day Free Trial",
    accentClass: "border-neutral-900 bg-neutral-950/40",
    highlighted: false,
    tag: "LAUNCH DEAL",
    features: [
      "0% Meta Conversation Markup Tax",
      "Standard Abandoned Cart Tracking",
      "Native Multilingual Shifting (Hinglish/Hindi)",
      "Real-Time Shopify Webhook Sync",
      "Standard Email Support Response"
    ]
  },
  {
    key: "DOUBLE",
    name: "Growth LTD",
    audience: "Most popular for scaling stores",
    priceINR: "₹18,895",
    priceUSD: "$199",
    description: "Advanced automation nodes with cross-channel failover fallback.",
    cta: "Secure Lifetime Access",
    accentClass: "border-emerald-500/30 bg-neutral-950/60 shadow-2xl shadow-emerald-500/[0.02]",
    highlighted: true,
    tag: "MOST POPULAR",
    features: [
      "Everything in the Starter LTD Plan",
      "Intelligent Multi-Channel SMS Fallback",
      "Priority Beta Access to AI Automation Factory",
      "Dedicated Whatsapp Account Manager",
      "Custom Webhook Integration Assistance"
    ]
  },
  {
    key: "MULTIPLE",
    name: "Agency LTD",
    audience: "For multi-brand operators & agencies",
    priceINR: "₹37,885",
    priceUSD: "$399",
    description: "Full white-label workspace matrix for aggregate reseller client ops.",
    cta: "Deploy Agency Infrastructure",
    accentClass: "border-neutral-900 bg-neutral-950/40",
    highlighted: false,
    tag: "UNLIMITED",
    features: [
      "Everything in the Growth LTD Plan",
      "White-label Client Workspace Matrix",
      "Separate Brands & Permissions Management",
      "Aggregate Reporting Views for Resellers",
      "24/7 Priority SLA VIP Support Node"
    ]
  }
];

export default function Pricing() {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');

  const handleCheckout = (tierKey: LifetimeDealTier) => {
    const targetUrl = currency === 'INR' 
      ? RAZORPAY_CHECKOUT_URLS[tierKey] 
      : STRIPE_CHECKOUT_URLS[tierKey];
      
    if (targetUrl) {
      window.open(targetUrl, '_blank');
    }
  };

  return (
    // 🎯 Scroll Fixed: Connected layout IDs so landing page anchors snap straight here
    <section id="trial" className="w-full bg-[#0B0F17] text-white py-20 px-4 sm:px-6 lg:px-8 border-t border-neutral-900/60 relative">
      <div id="pricing" className="absolute -top-20" /> 
      
      <div className="max-w-7xl mx-auto flex flex-col items-center space-y-12 text-center">
        
        {/* Header Typography */}
        <div className="max-w-3xl space-y-4">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            Predictable tiers. <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">Zero Variable Markup Surprises</span>.
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl mx-auto">
            Choose the operational architecture that scales your store volume. All plans directly tunnel Meta's base cloud conversation charges without adding commissions.
          </p>
        </div>

        {/* 🌐 Currency Switcher Toggle */}
        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-neutral-950 border border-neutral-900 shadow-inner relative z-10">
          <button
            type="button"
            onClick={() => setCurrency('INR')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all duration-200 ${
              currency === 'INR' 
                ? 'bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 shadow-md' 
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            🇮🇳 India (INR ₹)
          </button>
          <button
            type="button"
            onClick={() => setCurrency('USD')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all duration-200 ${
              currency === 'USD' 
                ? 'bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 shadow-md' 
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            🌐 International (USD $)
          </button>
        </div>

        {/* 📊 3-Column Responsive Grid Layout */}
        <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch pt-4 text-left">
          {pricingTiers.map((tier) => (
            <div 
              key={tier.key}
              className={`border rounded-3xl p-6 flex flex-col justify-between space-y-8 relative group transition-all duration-300 ${tier.accentClass}`}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase font-black tracking-widest text-neutral-500">{tier.name}</span>
                  <span className={`text-[9px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded border ${
                    tier.highlighted 
                      ? 'bg-emerald-950/60 text-[#00DF89] border-emerald-500/20' 
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                  }`}>
                    {tier.tag}
                  </span>
                </div>
                
                <div className="pt-2">
                  <p className={`text-2xl sm:text-3xl font-mono font-black ${tier.highlighted ? 'text-[#00DF89]' : 'text-white'}`}>
                    {currency === 'INR' ? tier.priceINR : tier.priceUSD}
                    <span className="text-xs font-normal text-neutral-500 font-sans">
                      {tier.key === 'SINGLE' ? '/month' : '/one-time'}
                    </span>
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">{tier.audience}</p>
                  <p className="text-xs text-neutral-500 mt-2 leading-relaxed">{tier.description}</p>
                </div>

                {/* Checklist Content */}
                <ul className="space-y-3 pt-4 text-xs font-bold text-neutral-300 border-t border-neutral-900/60">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#00DF89] shrink-0 mt-0.5" />
                      <span className="leading-tight">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 🎯 5. Click Action perfectly mapped to active function callbacks */}
              <button
                type="button"
                onClick={() => handleCheckout(tier.key)}
                className={`w-full py-3.5 text-center text-xs font-black rounded-xl transition-all active:scale-[0.98] ${
                  tier.highlighted 
                    ? 'bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 hover:opacity-95 shadow-md shadow-emerald-500/10' 
                    : 'border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:text-white'
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}