"use client";

import React from 'react';

const comparisonData = [
  {
    feature: "Conversation Markup Fee",
    cartrenew: "0% (Pure Meta Base Rates Only)",
    others: "Up to 15% - 20% Added Platform Premium Tax",
    highlight: true,
  },
  {
    feature: "Autonomous Multilingual Engine",
    cartrenew: "Native (Hinglish, Hindi, Regional Fallbacks)",
    others: "Rigid English-Only Fixed Templates",
    highlight: false,
  },
  {
    feature: "Shopify Checkout Integration",
    cartrenew: "Real-Time Zero Latency Sync Hooks",
    others: "Delayed Batch Syncing (Misses Active Carts)",
    highlight: false,
  },
  {
    feature: "Multi-Channel Fallback Automation",
    cartrenew: "Instant Intelligent SMS Fallback Reroute",
    others: "Manual Intervention or No Rerouting Capabilities",
    highlight: false,
  },
  {
    feature: "Hidden Implementation Tariffs",
    cartrenew: "Zero. Transparent Subscription Pricing",
    others: "Setup Charges + Extra Variable Costs Per Agent",
    highlight: true,
  }
];

export default function CompetitorComparison() {
  return (
    <section id="comparison" className="w-full bg-[#0B0F17] py-16 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative">
        
        {/* Section Typography Header Block */}
        <div className="max-w-3xl space-y-4 mb-16 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/20 border border-indigo-900/30 text-[10px] font-black uppercase tracking-widest text-indigo-400">
            The Hard Math
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
            Stop paying the traditional{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">
              Middleware Platform Tax
            </span>.
          </h2>
          <p className="text-neutral-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            See how CartRenew completely bypasses traditional markup models to preserve your e-commerce profit margins.
          </p>
        </div>

        {/* Responsive Matrix Comparison Board Table Wrapper */}
        <div className="w-full overflow-x-auto rounded-2xl border border-neutral-900 bg-neutral-950/20 backdrop-blur-md">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-neutral-900 bg-neutral-900/20">
                <th className="p-5 text-xs font-black uppercase tracking-wider text-neutral-500">Core Feature / Metric</th>
                <th className="p-5 text-xs font-black uppercase tracking-wider text-[#00DF89] bg-emerald-950/10">CartRenew Capabilities</th>
                <th className="p-5 text-xs font-black uppercase tracking-wider text-neutral-500">Legacy Tools (Wati, Zoko)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/60 font-medium text-sm">
              {comparisonData.map((row, idx) => (
                <tr 
                  key={idx} 
                  className={`transition-colors hover:bg-neutral-900/20 ${row.highlight ? 'bg-indigo-950/5' : ''}`}
                >
                  {/* Feature Title Node */}
                  <td className="p-5 text-white font-bold tracking-tight">
                    {row.feature}
                  </td>
                  
                  {/* CartRenew Native Value Matrix Column */}
                  <td className="p-5 text-[#00DF89] bg-emerald-950/[0.04] font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">✓</span> {row.cartrenew}
                    </div>
                  </td>
                  
                  {/* Legacy Old Competitors Column */}
                  <td className="p-5 text-neutral-400">
                    {row.others}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </section>
  );
}