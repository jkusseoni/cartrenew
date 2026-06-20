"use client";

import React, { useState } from 'react';
import { Check, Globe, MapPin, Zap, Crown } from "lucide-react";

type Market = "india" | "global";
type PlanType = "monthly" | "lifetime";

interface Tier {
  id: string;
  name: string;
  priceINR: string;
  priceUSD: string;
  description: string;
  features: string[];
  highlighted: boolean;
  tag: string;
  cta: string;
  accentClass: string;
  razorpayUrl: string; 
  stripeUrl: string;
}

// 📊 DATA 1: Monthly Subscription Plans
const monthlyTiers: Tier[] = [
  {
    id: "m-starter",
    name: "Starter",
    priceINR: "₹999",
    priceUSD: "$12",
    tag: "ENTRY LEVEL",
    description: "Perfect for small stores starting their automation journey.",
    cta: "Start 14-Day Free Trial",
    accentClass: "border-neutral-900 bg-neutral-950/40",
    highlighted: false,
    razorpayUrl: "https://rzp.io/rzp/Vb031St", 
    stripeUrl: "https://buy.stripe.com/test_monthly_starter",
    features: ["1 Store", "200 Cart Recoveries / month", "WhatsApp + Email", "0% Conversation Markup", "14-day Free Trial"]
  },
  {
    id: "m-growth",
    name: "Growth",
    priceINR: "₹2,499",
    priceUSD: "$29",
    tag: "MOST POPULAR",
    description: "Designed for scaling brands targeting higher conversion.",
    cta: "Start Free Trial Now",
    accentClass: "border-emerald-500/30 bg-neutral-950/60 shadow-2xl shadow-emerald-500/[0.02]",
    highlighted: true,
    razorpayUrl: "https://rzp.io/rzp/nhwzQWQd",
    stripeUrl: "https://buy.stripe.com/test_monthly_growth",
    features: ["3 Stores", "1,000 Cart Recoveries / month", "WhatsApp + Email + SMS", "AI Personalized Messages", "0% Conversation Markup", "COD Verification"]
  },
  {
    id: "m-scale",
    name: "Scale",
    priceINR: "₹5,999",
    priceUSD: "$69",
    tag: "ENTERPRISE",
    description: "Unlimited power for high-volume e-commerce operators.",
    cta: "Go Scale Now",
    accentClass: "border-neutral-900 bg-neutral-950/40",
    highlighted: false,
    razorpayUrl: "https://rzp.io/rzp/soM2kxu",
    stripeUrl: "https://buy.stripe.com/test_monthly_scale",
    features: ["Unlimited Stores", "Unlimited Recoveries", "All Channels", "AI Chatbot", "ShipRocket Integration", "Priority Support", "Custom Templates", "White-label Option"]
  }
];

// 📊 DATA 2: Lifetime Deal Plans
const lifetimeTiers: Tier[] = [
  {
    id: "l-starter",
    name: "Starter LTD",
    priceINR: "₹9,400",
    priceUSD: "$99",
    tag: "LAUNCH DEAL",
    description: "Core autonomous recovery system. Pay once, use forever.",
    cta: "Get Lifetime Access",
    accentClass: "border-neutral-900 bg-neutral-950/40",
    highlighted: false,
    razorpayUrl: "https://rzp.io/rzp/6LhjxROW",
    stripeUrl: "https://buy.stripe.com/test_ltd_starter",
    features: ["1 Storefront Integration", "Up to 500 recoveries/mo", "0% Meta Markup Tax", "Native Multilingual (Hinglish)", "Standard Email Support"]
  },
  {
    id: "l-growth",
    name: "Growth LTD",
    priceINR: "₹18,895",
    priceUSD: "$199",
    tag: "MOST POPULAR",
    description: "Advanced automation nodes with cross-channel failover.",
    cta: "Secure Lifetime Access",
    accentClass: "border-emerald-500/30 bg-neutral-950/60 shadow-2xl shadow-emerald-500/[0.02]",
    highlighted: true,
    razorpayUrl: "https://rzp.io/rzp/pU7Y7xTj",
    stripeUrl: "https://buy.stripe.com/test_ltd_growth",
    features: ["3 Storefront Integrations", "Unlimited recovery sessions", "Priority AI Personalization", "Dedicated Whatsapp Manager", "Custom Webhook Assistance"]
  },
  {
    id: "l-agency",
    name: "Agency LTD",
    priceINR: "₹37,885",
    priceUSD: "$399",
    tag: "UNLIMITED",
    description: "Full white-label workspace for aggregate reseller ops.",
    cta: "Deploy Agency Infrastructure",
    accentClass: "border-neutral-900 bg-neutral-950/40",
    highlighted: false,
    razorpayUrl: "https://rzp.io/rzp/emdA9Lmk",
    stripeUrl: "https://buy.stripe.com/test_ltd_agency",
    features: ["Unlimited Storefronts", "White-label Workspace Matrix", "Separate Brand Permissions", "Aggregate Reporting Views", "24/7 Priority SLA VIP Support"]
  }
];

export default function Pricing() {
  const [market, setMarket] = useState<Market>('india');
  const [planType, setPlanType] = useState<PlanType>('monthly');

  const activeTiers = planType === 'monthly' ? monthlyTiers : lifetimeTiers;

  const handleCheckout = (tier: Tier) => {
    const url = market === 'india' ? tier.razorpayUrl : tier.stripeUrl;
    if (url) window.open(url, '_blank');
  };

  return (
    <section id="pricing" className="w-full bg-[#0B0F17] text-white py-20 px-4 sm:px-6 lg:px-8 border-t border-neutral-900/60 relative">
      <div className="max-w-7xl mx-auto flex flex-col items-center space-y-12 text-center">
        
        {/* Header Section */}
        <div className="max-w-3xl space-y-4">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            {planType === 'monthly' 
              ? "Predictable tiers. " : "Lifetime Deals, No Monthly Fees. "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">
              {planType === 'monthly' ? "Zero Variable Markup Surprises" : "Grandfathered Access"}
            </span>.
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl mx-auto">
            {planType === 'monthly' 
              ? "Choose the operational architecture that scales your store volume. All plans directly tunnel Meta's base cloud conversation charges." 
              : "Lock in your access to CartRenew’s automated AI cart recovery pipeline today and never pay a monthly fee again."}
          </p>
        </div>

        {/* 🛠️ TOP SWITCHERS */}
        <div className="flex flex-col sm:flex-row items-center gap-6">
          
          {/* 1. Monthly vs Lifetime Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-neutral-950 border border-neutral-800 shadow-xl">
            <button
              onClick={() => setPlanType('monthly')}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                planType === 'monthly' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Zap size={14} /> Monthly
            </button>
            <button
              onClick={() => setPlanType('lifetime')}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                planType === 'lifetime' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Crown size={14} /> Lifetime
            </button>
          </div>

          {/* 2. India vs Global Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-neutral-950 border border-neutral-800 shadow-xl">
            <button
              onClick={() => setMarket('india')}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                market === 'india' ? 'bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <MapPin size={12} /> India (INR ₹)
            </button>
            <button
              onClick={() => setMarket('global')}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                market === 'global' ? 'bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Globe size={12} /> Global (USD $)
            </button>
          </div>
        </div>

        {/* 📊 Pricing Grid */}
        <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch pt-4 text-left">
          {activeTiers.map((tier) => (
            <div 
              key={tier.id}
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
                    {market === 'india' ? tier.priceINR : tier.priceUSD}
                    <span className="text-xs font-normal text-neutral-500 font-sans ml-2">
                      {planType === 'monthly' ? '/month' : '/one-time'}
                    </span>
                  </p>
                  <p className="text-xs text-neutral-500 mt-2 leading-relaxed">{tier.description}</p>
                </div>

                <ul className="space-y-3 pt-4 text-xs font-bold text-neutral-300 border-t border-neutral-900/60">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#00DF89] shrink-0 mt-0.5" />
                      <span className="leading-tight">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleCheckout(tier)}
                className={`w-full py-3.5 text-center text-xs font-black rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                  tier.highlighted 
                    ? 'bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 hover:opacity-95 shadow-md shadow-emerald-500/10' 
                    : 'border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:text-white'
                }`}
              >
                {tier.cta} <Zap size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
