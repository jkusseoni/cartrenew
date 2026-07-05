"use client";

import React, { use, useState } from 'react';
import Link from 'next/link';

// Mock Data for pre-configured automation templates
const initialTemplates = [
  {
    id: "TMP-01",
    name: "Immediate Cart Drop (15 Mins)",
    type: "WhatsApp AI Node",
    message: "Hey {{customer_name}}, we noticed you left some great items in your cart. No worries, we've saved them for you! Click here to complete your order instantly: {{checkout_url}}",
    active: true,
    stats: { sent: 840, recovered: 294, rate: "35%" }
  },
  {
    id: "TMP-02",
    name: "High-Intent Discount Trigger (2 Hours)",
    type: "WhatsApp AI Node",
    message: "Don't miss out, {{customer_name}}! Use code CART10 at checkout to claim an instant 10% OFF on your pending items. Secure it now before stocks run out: {{checkout_url}}",
    active: true,
    stats: { sent: 310, recovered: 148, rate: "47%" }
  },
  {
    id: "TMP-03",
    name: "Last Chance SMS Fallback (24 Hours)",
    type: "Backup SMS Node",
    message: "CR-ALERT: Hey {{customer_name}}, this is your final chance to claim your reserved cart items with free shipping. Complete your checkout here: {{checkout_url}}",
    active: false,
    stats: { sent: 90, recovered: 12, rate: "13%" }
  }
];

export default function MarketingHub({ params }) {
  use(params);
  const [templates, setTemplates] = useState(initialTemplates);

  // 🎯 Fixed: TypeScript type annotation (: string) ko hata kar pure JS kar diya hai
  const toggleTemplate = (id) => {
    setTemplates(templates.map(t => t.id === id ? { ...t, active: !t.active } : t));
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col lg:flex-row">
      
      {/* 🧭 SIDEBAR NAVIGATION */}
      <aside className="w-full lg:w-64 bg-neutral-950 border-b lg:border-b-0 lg:border-r border-neutral-900 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight">
              Cart<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">Renew</span>
            </span>
            <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">v0.1</span>
          </div>

          <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 text-xs font-bold text-neutral-400">
            <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full">
              <span>🏠</span> Dashboard Summary
            </Link>
            <Link href="/marketing-hub" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900 text-[#00DF89] border border-neutral-800/40 shrink-0 lg:w-full">
              <span>💬</span> Automation Workflows
            </Link>
            <Link href="/analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full">
              <span>📈</span> ROI Analytics
            </Link>
            <Link href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full">
              <span>⚙️</span> Core Integration Settings
            </Link>
          </nav>
        </div>

        <div className="pt-4 border-t border-neutral-900 hidden lg:flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm">👤</div>
            <div>
              <p className="text-xs font-black text-neutral-200 leading-none">Merchant Account</p>
              <p className="text-[9px] text-neutral-500 font-mono mt-1">ID: Pro-Active</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 🛠️ MAIN WORKSPACE WINDOW */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto max-w-7xl">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900/60 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Automation Templates</h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">Design autonomous conversation sequences triggered by checkout actions.</p>
          </div>
          <button type="button" className="px-4 py-2.5 bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 text-xs font-black rounded-xl hover:opacity-90 transition-all self-start sm:self-auto">
            + Create Custom Node
          </button>
        </div>

        <div className="space-y-6">
          {templates.map((tmpl) => (
            <div 
              key={tmpl.id}
              className={`border rounded-2xl p-5 sm:p-6 bg-neutral-950/20 backdrop-blur-md flex flex-col lg:flex-row gap-6 items-stretch justify-between transition-all ${
                tmpl.active ? 'border-neutral-800/80' : 'border-neutral-900 opacity-60'
              }`}
            >
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-neutral-500">{tmpl.id}</span>
                  <h3 className="text-base font-bold text-white tracking-tight">{tmpl.name}</h3>
                  <span className={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded border ${
                    tmpl.type.includes('WhatsApp') 
                      ? 'bg-emerald-950/40 text-[#00DF89] border-emerald-900/30' 
                      : 'bg-amber-950/40 text-amber-400 border-amber-900/30'
                  }`}>
                    {tmpl.type}
                  </span>
                </div>

                <div className="bg-neutral-950/80 border border-neutral-900 rounded-xl p-3.5 font-sans text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-3xl shadow-inner relative">
                  {tmpl.message}
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] font-mono font-bold text-neutral-500">
                  <span>Available Variables:</span>
                  <span className="text-indigo-400 bg-indigo-950/20 border border-indigo-900/30 px-1.5 py-0.5 rounded">{"{{customer_name}}"}</span>
                  <span className="text-indigo-400 bg-indigo-950/20 border border-indigo-900/30 px-1.5 py-0.5 rounded">{"{{checkout_url}}"}</span>
                  <span className="text-indigo-400 bg-indigo-950/20 border border-indigo-900/30 px-1.5 py-0.5 rounded">{"{{discount_code}}"}</span>
                </div>
              </div>

              <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-neutral-900 pt-5 lg:pt-0 lg:pl-6 flex flex-row lg:flex-col justify-between items-center lg:items-stretch gap-4 shrink-0">
                <div className="grid grid-cols-3 gap-3 w-full text-center lg:text-left">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Dispatched</p>
                    <p className="text-sm font-mono font-black text-white mt-0.5">{tmpl.stats.sent}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Recovered</p>
                    <p className="text-sm font-mono font-black text-[#00DF89] mt-0.5">{tmpl.stats.recovered}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-[#00DF89] tracking-wider">Conv. Rate</p>
                    <p className="text-sm font-mono font-black text-[#00DF89] mt-0.5">{tmpl.stats.rate}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 lg:w-full lg:pt-4 lg:border-t lg:border-neutral-900/60 justify-end lg:justify-between">
                  <span className="text-[11px] font-bold text-neutral-400 hidden lg:inline">Node Status:</span>
                  <button 
                    type="button"
                    onClick={() => toggleTemplate(tmpl.id)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      tmpl.active 
                        ? 'bg-emerald-950 text-[#00DF89] border border-emerald-500/20 hover:bg-emerald-900/30' 
                        : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:bg-neutral-800/60'
                    }`}
                  >
                    {tmpl.active ? "🟢 Active Node" : "🔴 Paused Node"}
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>

      </main>
    </div>
  );
}