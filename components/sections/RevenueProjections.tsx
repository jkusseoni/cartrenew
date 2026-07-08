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
    // 🌸 सॉफ़्ट लाइट थीम कंटेनर
    <section id="projections" className="w-full bg-transparent py-16 relative overflow-hidden z-10">
      {/* Background Subtle Tech Grid Glow (Light Blue/Pink vibe) */}
      <div className="absolute top-[50%] left-[-20%] w-[500px] h-[500px] bg-blue-100/50 blur-[120px] rounded-full pointer-events-none mix-blend-multiply" />

      <div className="max-w-7xl mx-auto relative px-4 sm:px-6 lg:px-8">
        
        {/* Section Header Layout */}
        <div className="max-w-3xl space-y-4 mb-12 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-100 text-[10px] font-black uppercase tracking-widest text-cyan-600 shadow-sm">
            ROI Calculator
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight">
            Calculate your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">
              Recoverable Revenue Leak
            </span>.
          </h2>
          <p className="text-slate-500 text-sm sm:text-base max-w-2xl leading-relaxed font-medium">
            Drag the interactive slider below to match your store's current order metrics and watch your margins scale instantly.
          </p>
        </div>

        {/* Calculator Main Panel Box - Clean Glassmorphism */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white/70 border border-slate-200/80 rounded-3xl p-6 sm:p-8 backdrop-blur-md items-center shadow-sm">
          
          {/* Left Column: Slider Controls Inputs */}
          <div className="lg:col-span-6 space-y-8 bg-slate-50 border border-slate-200/60 p-6 rounded-2xl shadow-inner">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700">Your Monthly Store Orders</label>
                <span className="text-xl font-mono font-black text-blue-600 bg-white px-3 py-1 rounded-xl border border-slate-200/80 shadow-sm">
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
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 transition-all"
              />
              <div className="flex justify-between text-[10px] font-bold tracking-tight text-slate-400 px-1">
                <span>200 Orders</span>
                <span>10,000 Orders</span>
                <span>20,000+ Orders</span>
              </div>
            </div>

            {/* Micro Benchmark Metrics Stack List */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assumed Base AOV</p>
                <p className="text-sm font-mono font-black text-slate-700 mt-0.5">₹2,500</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Industry Abandonment</p>
                <p className="text-sm font-mono font-black text-slate-700 mt-0.5">70% Standard</p>
              </div>
            </div>
          </div>

          {/* Right Column: Projected Savings Visual Dashboard Results display */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
            
            {/* Monthly Recovery Block Display Panel */}
            <div className="bg-gradient-to-br from-emerald-50/50 via-white to-white border border-emerald-100 rounded-2xl p-6 flex flex-col justify-between shadow-md shadow-emerald-500/[0.02] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100/20 blur-xl rounded-full group-hover:bg-emerald-100/40 transition-all duration-500" />
              <div>
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded border border-emerald-100 shadow-sm">
                  Monthly Recovery
                </span>
                <p className="text-2xl sm:text-3xl font-mono font-black text-emerald-600 mt-6 tracking-tight" suppressHydrationWarning>
                  ₹{monthlySavings.toLocaleString('en-IN')}
                </p>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed font-medium">
                Estimated extra revenue funneled back into your bank account next month.
              </p>
            </div>

            {/* Annual Scaled Projections Display Panel */}
            <div className="bg-gradient-to-br from-blue-50/50 via-white to-white border border-blue-100 rounded-2xl p-6 flex flex-col justify-between shadow-md shadow-blue-500/[0.02] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/20 blur-xl rounded-full group-hover:bg-blue-100/40 transition-all duration-500" />
              <div>
                <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded border border-blue-100 shadow-sm">
                  Annual Growth Scaled
                </span>
                <p className="text-2xl sm:text-3xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600 mt-6 tracking-tight" suppressHydrationWarning>
                  ₹{annualSavings.toLocaleString('en-IN')}
                </p>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed font-medium">
                Exhaustive recurring sales unlocked annually with automated recovery cycles.
              </p>
            </div>

          </div>

         </div>

      </div>
    </section>
  );
}