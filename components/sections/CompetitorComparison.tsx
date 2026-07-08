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
    // 🌸 सॉफ़्ट लाइट बैकग्राउंड विथ कंटेनर पैडिंग
    <section id="comparison" className="w-full bg-transparent py-16 relative overflow-hidden z-10">
      <div className="max-w-7xl mx-auto relative px-4 sm:px-6 lg:px-8">
        
        {/* Section Typography Header Block */}
        <div className="max-w-3xl space-y-4 mb-16 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-sm">
            The Hard Math
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight">
            Stop paying the traditional{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">
              Middleware Platform Tax
            </span>.
          </h2>
          <p className="text-slate-500 text-sm sm:text-base max-w-2xl leading-relaxed font-medium">
            See how CartRenew completely bypasses traditional markup models to preserve your e-commerce profit margins.
          </p>
        </div>

        {/* Responsive Matrix Comparison Board Table Wrapper - Clean Light Look */}
        <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-md shadow-sm">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="p-5 text-xs font-black uppercase tracking-wider text-slate-500">Core Feature / Metric</th>
                <th className="p-5 text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50/60">CartRenew Capabilities</th>
                <th className="p-5 text-xs font-black uppercase tracking-wider text-slate-500">Legacy Tools (Wati, Zoko)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-sm">
              {comparisonData.map((row, idx) => (
                <tr 
                  key={idx} 
                  className={`transition-colors hover:bg-slate-50/40 ${row.highlight ? 'bg-indigo-50/30' : ''}`}
                >
                  {/* Feature Title Node */}
                  <td className="p-5 text-slate-900 font-bold tracking-tight">
                    {row.feature}
                  </td>
                  
                  {/* CartRenew Native Value Matrix Column (Light Emerald Glow) */}
                  <td className="p-5 text-emerald-600 bg-emerald-50/[0.25] font-bold">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-emerald-100 text-emerald-700 w-4 h-4 rounded-full flex items-center justify-center font-black">✓</span> 
                      {row.cartrenew}
                    </div>
                  </td>
                  
                  {/* Legacy Old Competitors Column */}
                  <td className="p-5 text-slate-500 font-medium">
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