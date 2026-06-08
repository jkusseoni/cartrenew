"use client";

import React, { useState } from 'react';

export default function RevenueProjections() {
  // Interactive State Hooks for dynamic slider calculations
  const [monthlyOrders, setMonthlyOrders] = useState<number>(2000);
  
  // Static average business benchmarks
  const averageOrderValue = 2500; // ₹2,500 AOV standard
  const abandonmentRate = 0.70;   // 70% standard cart abandonment
  const cartrenewRecoveryRate = 0.35; // Conservative 35% recovery calculation

  // Dynamic Math Logic Projections
  const abandonedCarts = Math.round(monthlyOrders * abandonmentRate);
  const potentialRecoveredCarts = Math.round(abandonedCarts * cartrenewRecoveryRate);
  const monthlySavings = potentialRecoveredCarts * averageOrderValue;
  const annualSavings = monthlySavings * 12;

  return (
    <section id="projections" className="w-full bg-[#0B0F17] py-16 relative overflow-hidden">
      {/* Background Subtle Tech Grid Glow */}
      <div className="absolute top-[50%] left-[-20%] w-[500px] h-[500px] bg-cyan-500/[0.02] blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto relative">
        
        {/* Section Header Layout */}
        <div className="max-w-3xl space-y-4 mb-12 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/20 border border-cyan-900/30 text-[10px] font-black uppercase tracking-widest text-[#00D1FF]">
            ROI Calculator
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
            Calculate your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">
              Recoverable Revenue Leak
            </span>.
          </h2>
          <p className="text-neutral-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            Drag the interactive slider below to match your store's current order metrics and watch your margins scale instantly.
          </p>
        </div>

        {/* Calculator Main Panel Box Dashboard Layout */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 bg-neutral-900/10 border border-neutral-900 rounded-3xl p-6 sm:p-8 backdrop-blur-md items-center">
          
          {/* Left Column: Slider Controls Inputs */}
          <div className="lg:col-span-6 space-y-8 bg-neutral-950/40 border border-neutral-900/60 p-6 rounded-2xl">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-neutral-300">Your Monthly Store Orders</label>
                <span className="text-xl font-mono font-black text-[#00D1FF] bg-neutral-900 px-3 py-1 rounded-lg border border-neutral-800">
                  {monthlyOrders.toLocaleString()}
                </span>
              </div>
              
              {/* Range Input Slider */}
              <input 
                type="range" 
                min="200" 
                max="20000" 
                step="100"
                value={monthlyOrders}
                onChange={(e) => setMonthlyOrders(parseInt(e.target.value))}
                className="w-full h-2 bg-neutral-900 rounded-lg appearance-none cursor-pointer accent-[#00DF89] transition-all"
              />
              <div className="flex justify-between text-[10px] font-bold tracking-tight text-neutral-600 px-1">
                <span>200 Orders</span>
                <span>10,000 Orders</span>
                <span>20,000+ Orders</span>
              </div>
            </div>

            {/* Micro Benchmark Metrics Stack List */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-neutral-900">
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Assumed Base AOV</p>
                <p className="text-sm font-mono font-bold text-neutral-300 mt-0.5">₹2,500</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Industry Abandonment</p>
                <p className="text-sm font-mono font-bold text-neutral-300 mt-0.5">70% Standard</p>
              </div>
            </div>
          </div>

          {/* Right Column: Projected Savings Visual Dashboard Results display */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
            
            {/* Monthly Recovery Block Display Panel */}
            <div className="bg-gradient-to-br from-emerald-950/20 to-neutral-950 border border-emerald-900/30 rounded-2xl p-6 flex flex-col justify-between shadow-xl shadow-emerald-950/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#00DF89]/[0.01] blur-xl rounded-full group-hover:bg-[#00DF89]/[0.03] transition-all duration-500" />
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-neutral-950/80 px-2 py-1 rounded border border-neutral-900">
                  Monthly Recovery
                </span>
                {/* 🎯 Fixed: Explicit locale system formatting aur hydration safety checks lagaye */}
                <p className="text-2xl sm:text-3xl font-mono font-black text-[#00DF89] mt-6 tracking-tight" suppressHydrationWarning>
                  ₹{monthlySavings.toLocaleString('en-IN')}
                </p>
              </div>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                Estimated extra revenue funneled back into your bank account next month.
              </p>
            </div>

            {/* Annual Scaled Projections Display Panel */}
            <div className="bg-gradient-to-br from-indigo-950/20 to-neutral-950 border border-indigo-900/30 rounded-2xl p-6 flex flex-col justify-between shadow-xl shadow-indigo-950/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#00D1FF]/[0.01] blur-xl rounded-full group-hover:bg-[#00D1FF]/[0.03] transition-all duration-500" />
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-neutral-950/80 px-2 py-1 rounded border border-neutral-900">
                  Annual Growth Scaled
                </span>
                {/* 🎯 Fixed: Explicit locale system formatting aur hydration safety checks lagaye */}
                <p className="text-2xl sm:text-3xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF] mt-6 tracking-tight" suppressHydrationWarning>
                  ₹{annualSavings.toLocaleString('en-IN')}
                </p>
              </div>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                Exhaustive recurring sales unlocked annually with automated recovery cycles.
              </p>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}