"use client";

import React from 'react';

const pricingPlans = [
  {
    name: "Growth Monthly",
    price: "₹3,499",
    period: "/month",
    desc: "Perfect for scaling Shopify stores looking to eliminate high middleware cart abandonment leak charges.",
    features: [
      "0% Meta Conversation Markup Tax",
      "Unlimited Abandoned Cart Tracking",
      "Native Multilingual Shifting (Hinglish/Hindi)",
      "Real-Time Shopify Webhook Sync",
      "Intelligent Multi-Channel SMS Fallback",
      "Standard Email Support Response"
    ],
    cta: "Start 14-Day Free Trial",
    popular: false,
    badge: "Flexible"
  },
  {
    name: "Lifetime Founder Deal",
    price: "₹14,999",
    period: "/one-time",
    desc: "Exclusive launch offer for early adopters. Pay once, use forever. Zero recurring software fees.",
    features: [
      "Everything in the Growth Monthly Plan",
      "Lifetime Core License Access (No Renewals)",
      "Priority Beta Access to AI Automation Factory",
      "Dedicated Whatsapp Account Manager",
      "Custom Webhook Integration Assistance",
      "24/7 Priority SLA VIP Support Node"
    ],
    cta: "Secure Lifetime Access",
    popular: true,
    badge: "Most Popular / Limited"
  }
];

export default function Pricing() {
  return (
    <section id="pricing" className="w-full bg-[#0B0F17] py-16 relative overflow-hidden">
      {/* Background Symmetrical Design Radial Highlights */}
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-500/[0.02] blur-[100px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative">
        
        {/* Section Header Layout Text Block */}
        <div className="max-w-3xl space-y-4 mb-16 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/20 border border-emerald-900/30 text-[10px] font-black uppercase tracking-widest text-[#00DF89]">
            Transparent Framework
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
            Predictable tiers.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">
              Zero Variable Markup Surprises
            </span>.
          </h2>
          <p className="text-neutral-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            Choose the operational architecture that scales your store volume. All plans directly tunnel Meta's base cloud conversation charges without adding commissions.
          </p>
        </div>

        {/* Dual Component Pricing Cards Grid Matrix wrapper */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto items-stretch">
          {pricingPlans.map((plan, idx) => (
            <div 
              key={idx}
              className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between border relative transition-all duration-300 ${
                plan.popular 
                  ? 'bg-gradient-to-b from-neutral-900/40 to-neutral-950/60 border-emerald-500/30 shadow-2xl shadow-emerald-950/10' 
                  : 'bg-neutral-950/20 border-neutral-900/80 hover:border-neutral-800'
              }`}
            >
              {/* Popularity Top Ribbon Accent Hook */}
              <div className="flex items-center justify-between gap-4 mb-6">
                <span className="text-sm font-black text-white tracking-tight uppercase">
                  {plan.name}
                </span>
                <span className={`text-[9px] font-mono font-black tracking-wider uppercase px-2.5 py-1 rounded-md ${
                  plan.popular 
                    ? 'bg-emerald-950 text-[#00DF89] border border-emerald-500/20' 
                    : 'bg-neutral-900 text-neutral-400 border border-neutral-800/60'
                }`}>
                  {plan.badge}
                </span>
              </div>

              {/* Price Content Component Container block */}
              <div className="space-y-4">
                <div className="flex items-baseline gap-1 text-white">
                  <span className="text-4xl sm:text-5xl font-mono font-black tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-neutral-500 text-sm font-bold">
                    {plan.period}
                  </span>
                </div>
                <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                  {plan.desc}
                </p>

                {/* Horizontal Divider break lines */}
                <div className="w-full h-[1px] bg-neutral-900/80 my-6" />

                {/* Features Checklist Map Stream */}
                <ul className="space-y-3.5 text-xs sm:text-sm font-medium text-neutral-300">
                  {plan.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-3">
                      <span className="text-[#00DF89] font-black shrink-0">✓</span>
                      <span className="leading-tight text-neutral-300">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA Interface Response Action Nodes */}
              <div className="pt-8">
                <button className={`w-full py-4 rounded-xl text-xs sm:text-sm font-black tracking-tight transition-all active:scale-[0.98] ${
                  plan.popular
                    ? 'bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 shadow-xl shadow-emerald-500/10 hover:opacity-95'
                    : 'bg-neutral-900 text-neutral-200 border border-neutral-800 hover:bg-neutral-800 hover:text-white'
                }`}>
                  {plan.cta}
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}