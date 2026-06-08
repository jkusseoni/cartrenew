"use client";

import React, { useState, useMemo } from 'react';
import { Check } from 'lucide-react';

type Market = 'india' | 'global';

type Plan = {
  id: string;
  name: string;
  price: string;
  cadence: string;
  features: string[];
  cta: string;
  accent: string;
  highlight?: 'MOST_POPULAR' | 'BEST_VALUE';
  checkoutUrl: string; // Dynamic dedicated link selector
};

export default function PricingTable() {
  const [market, setMarket] = useState<Market>('india');

  // 💳 Mapped perfectly with your live Indian Razorpay and Global parameters
  const plans = useMemo(() => {
    return {
      india: [
        {
          id: 'in-starter',
          name: 'Starter',
          price: '₹999',
          cadence: '/month',
          checkoutUrl: 'https://rzp.io/rzp/Vb031St', // ✅ Real Live Razorpay Link 1
          cta: 'Start 14-Day Free Trial',
          accent: 'border-neutral-900 bg-neutral-950/40',
          features: ['1 Store', '200 Cart Recoveries / month', 'WhatsApp + Email', 'Basic Dashboard', '0% Conversation Markup', '14-day Free Trial']
        },
        {
          id: 'in-growth',
          name: 'Growth',
          price: '₹2,499',
          cadence: '/month',
          checkoutUrl: 'https://rzp.io/rzp/nhwzQWQd', // ✅ Real Live Razorpay Link 2
          cta: 'Start Free Trial Node',
          accent: 'border-emerald-500/30 bg-neutral-950/60 shadow-xl shadow-emerald-500/[0.01]',
          highlight: 'MOST_POPULAR',
          features: ['3 Stores', '1,000 Cart Recoveries / month', 'WhatsApp + Email + SMS', 'AI Personalized Messages', '0% Conversation Markup', 'COD Verification']
        },
        {
          id: 'in-scale',
          name: 'Scale',
          price: '₹5,999',
          cadence: '/month',
          checkoutUrl: 'https://rzp.io/rzp/soM2kxu', // ✅ Real Live Razorpay Link 3
          cta: 'Go Scale',
          accent: 'border-neutral-900 bg-neutral-950/40',
          highlight: 'BEST_VALUE',
          features: ['Unlimited Stores', 'Unlimited Recoveries', 'All Channels', 'AI Chatbot', 'Shiprocket Integration', 'Priority Support', 'Custom Templates', 'White Label Option']
        }
      ],
      global: [
        {
          id: 'gl-starter',
          name: 'Starter',
          price: '$12',
          cadence: '/month',
          // 🔄 Replace with real Lemon Squeezy Link once your store is activated
          checkoutUrl: 'https://cartrenew.lemonsqueezy.com/checkout/buy/starter-id', 
          cta: 'Start Global Trial',
          accent: 'border-neutral-900 bg-neutral-950/40',
          features: ['1 Store', '200 Cart Recoveries / month', 'WhatsApp + Email', 'Basic Dashboard', '0% Conversation Markup']
        },
        {
          id: 'gl-growth',
          name: 'Growth',
          price: '$29',
          cadence: '/month',
          checkoutUrl: 'https://cartrenew.lemonsqueezy.com/checkout/buy/growth-id', 
          cta: 'Get Growth Mode',
          accent: 'border-emerald-500/30 bg-neutral-950/60 shadow-xl shadow-emerald-500/[0.01]',
          highlight: 'MOST_POPULAR',
          features: ['3 Stores', '1,000 Cart Recoveries / month', 'WhatsApp + Email + SMS', 'AI Personalized Messages', '0% Conversation Markup']
        },
        {
          id: 'gl-scale',
          name: 'Scale',
          price: '$69',
          cadence: '/month',
          checkoutUrl: 'https://cartrenew.lemonsqueezy.com/checkout/buy/scale-id', 
          cta: 'Go Unlimited Scale',
          accent: 'border-neutral-900 bg-neutral-950/40',
          highlight: 'BEST_VALUE',
          features: ['Unlimited Stores', 'Unlimited Recoveries', 'All Channels', 'AI Chatbot', 'Priority Support', 'White Label Option']
        }
      ]
    };
  }, []);

  const activePlans = plans[market];

  return (
    <section id="trial" className="w-full bg-[#0B0F17] text-white py-20 px-4 sm:px-6 lg:px-8 border-t border-neutral-900/60 relative">
      <div id="pricing" className="absolute -top-20" />

      <div className="max-w-7xl mx-auto flex flex-col items-center space-y-12 text-center">
        
        <div className="max-w-3xl space-y-4">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            Predictable tiers. <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">Zero Variable Markup Surprises</span>.
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl mx-auto">
            Choose the operational architecture that scales your store volume. All plans directly tunnel Meta's base cloud conversation charges without adding commissions.
          </p>
        </div>

        {/* 🌐 LIVE TOGGLE HUB */}
        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-neutral-950 border border-neutral-900 shadow-inner relative z-10">
          <button
            type="button"
            onClick={() => setMarket('india')}
            className={`px-5 py-2.5 rounded-lg text-xs font-black transition-all duration-200 ${
              market === 'india'
                ? 'bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 shadow-md'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            🇮🇳 India (INR ₹)
          </button>
          <button
            type="button"
            onClick={() => setMarket('global')}
            className={`px-5 py-2.5 rounded-lg text-xs font-black transition-all duration-200 ${
              market === 'global'
                ? 'bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 shadow-md'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            🌐 Global (USD $)
          </button>
        </div>

        {/* 📊 3-COLUMN CARDS GRID */}
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch pt-4 text-left">
          {activePlans.map((plan) => (
            <div
              key={plan.id}
              className={`border rounded-3xl p-6 flex flex-col justify-between space-y-8 relative group transition-all duration-300 ${plan.accent}`}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase font-black tracking-widest text-neutral-500">{plan.name}</span>
                  {plan.highlight && (
                    <span className={`text-[8px] font-black tracking-wider uppercase px-2 py-0.5 rounded border ${
                      plan.highlight === 'MOST_POPULAR'
                        ? 'bg-emerald-950/60 text-[#00DF89] border-emerald-500/20'
                        : 'bg-cyan-950/60 text-cyan-400 border-cyan-500/20'
                    }`}>
                      {plan.highlight.replace('_', ' ')}
                    </span>
                  )}
                </div>

                <div className="pt-1">
                  <p className="text-3xl font-mono font-black text-white">
                    {plan.price}
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

              {/* 🎯 External Redirect: Standard HTML standard anchor for zero routing interception */}
              <a
                href={plan.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full py-3.5 text-center text-xs font-black rounded-xl transition-all block active:scale-[0.98] ${
                  plan.highlight === 'MOST_POPULAR'
                    ? 'bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 hover:opacity-95 shadow-md shadow-emerald-500/10'
                    : 'border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:text-white'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}