"use client";

import React, { useState } from 'react';
import Link from 'next/link';

// Mock Data for Live Abandoned Cart Stream Tracking
const recentCarts = [
  { id: "CR-9082", customer: "Aman Sharma", items: "3 Items (Premium Hoodie, Sneakers)", value: "₹6,499", time: "2 mins ago", status: "Recovered", channel: "WhatsApp AI" },
  { id: "CR-9081", customer: "Priya Patel", items: "1 Item (Wireless Earbuds)", value: "₹2,199", time: "14 mins ago", status: "AI Sent", channel: "WhatsApp AI" },
  { id: "CR-9080", customer: "Rajesh Kumar", items: "2 Items (Mechanical Keyboard, Mouse)", value: "₹4,850", time: "1 hour ago", status: "SMS Fallback", channel: "Backup SMS" },
  { id: "CR-9079", customer: "Sneha Reddy", items: "5 Items (Skincare Set)", value: "₹8,200", time: "3 hours ago", status: "Recovered", channel: "WhatsApp AI" },
  { id: "CR-9078", customer: "Vikram Singh", items: "1 Item (Leather Wallet)", value: "₹1,500", time: "5 hours ago", status: "Abandoned", channel: "Pending Node" }
];

export default function Dashboard() {
  const [activeStore] = useState("My Shopify Store");

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col lg:flex-row">
      
      {/* 🧭 1. SIDEBAR NAVIGATION HOOK */}
      <aside className="w-full lg:w-64 bg-neutral-950 border-b lg:border-b-0 lg:border-r border-neutral-900 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          {/* Brand Identity */}
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight">
              Cart<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">Renew</span>
            </span>
            <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">v0.1</span>
          </div>

          {/* Store Selector Simulation */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-neutral-900 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center text-xs text-[#00DF89]">🛍️</div>
              <span className="text-xs font-bold text-neutral-200 truncate max-w-[120px]">{activeStore}</span>
            </div>
            <span className="text-[10px] text-neutral-500">▼</span>
          </div>

          {/* Nav Action Links Cluster */}
          <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 text-xs font-bold text-neutral-400">
            <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900 text-[#00DF89] border border-neutral-800/40 shrink-0 lg:w-full">
              <span>🏠</span> Dashboard Summary
            </Link>
            <Link href="/marketing-hub" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full">
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

        {/* Bottom User Session Row */}
        <div className="pt-4 border-t border-neutral-900 hidden lg:flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm">👤</div>
            <div>
              <p className="text-xs font-black text-neutral-200 leading-none">Merchant Account</p>
              <p className="text-[9px] text-neutral-500 font-mono mt-1">ID: Pro-Active</p>
            </div>
          </div>
          <Link href="/" className="text-xs font-bold text-neutral-500 hover:text-rose-400 transition-colors">Logout</Link>
        </div>
      </aside>

      {/* 📊 2. MAIN DASHBOARD HUB VIEW WINDOW */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto max-w-7xl">
        
        {/* Dynamic Greeting Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900/60 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Console Workspace</h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">Real-time status monitoring of Shopify client abandonment triggers.</p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-xs font-bold text-[#00DF89]">
            <span className="w-2 h-2 rounded-full bg-[#00DF89] animate-pulse" />
            Live Webhook Streams Syncing
          </div>
        </div>

        {/* 📈 3. CORE METRICS OVERVIEW PANEL MATRIX */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
            <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Total Recovered Sales</p>
            <p className="text-2xl font-mono font-black text-[#00DF89] mt-2" suppressHydrationWarning>₹45,200</p>
            <p className="text-[10px] text-neutral-400 mt-1">From +18 orders this cycle</p>
          </div>
          <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
            <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Net Recovery Ratio</p>
            <p className="text-2xl font-mono font-black text-white mt-2">68%</p>
            <p className="text-[10px] text-[#00DF89] font-bold mt-1">↑ 4% above benchmark</p>
          </div>
          <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
            <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Active Automation Flows</p>
            <p className="text-2xl font-mono font-black text-white mt-2">1,240</p>
            <p className="text-[10px] text-neutral-400 mt-1">Meta WhatsApp API nodes open</p>
          </div>
          <div className="bg-neutral-950/40 border border-neutral-900 p-5 rounded-2xl">
            <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Platform Middleware Saved</p>
            <p className="text-2xl font-mono font-black text-[#00D1FF] mt-2" suppressHydrationWarning>₹9,840</p>
            <p className="text-[10px] text-neutral-400 mt-1">Saved via 0% markup protocol</p>
          </div>
        </div>

        {/* ⚡ 4. LIVE TRANSACTION TRACKING STREAM TABLE */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Continuous Recovery Stream</h3>
            <p className="text-xs text-neutral-400">Live feed mapping incoming Shopify webhooks directly to communication nodes.</p>
          </div>

          <div className="w-full overflow-x-auto rounded-2xl border border-neutral-900 bg-neutral-950/20 backdrop-blur-md">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-neutral-900 bg-neutral-900/30 text-xs font-black uppercase tracking-wider text-neutral-500">
                  <th className="p-4">Session ID</th>
                  <th className="p-4">Customer profile</th>
                  <th className="p-4">Cart Value</th>
                  <th className="p-4">Time Elapsed</th>
                  <th className="p-4">Active Channel</th>
                  <th className="p-4 text-right">Execution Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900/50 font-medium text-xs sm:text-sm text-neutral-300">
                {recentCarts.map((cart, idx) => (
                  <tr key={idx} className="hover:bg-neutral-900/20 transition-colors">
                    <td className="p-4 font-mono font-bold text-neutral-400">{cart.id}</td>
                    <td className="p-4">
                      <div>
                        <p className="font-bold text-white leading-tight">{cart.customer}</p>
                        <p className="text-[10px] text-neutral-500 mt-0.5 max-w-[200px] truncate">{cart.items}</p>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-bold text-neutral-200">{cart.value}</td>
                    <td className="p-4 text-neutral-400">{cart.time}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400">
                        {cart.channel}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        cart.status === 'Recovered' ? 'bg-emerald-950/40 text-[#00DF89] border border-emerald-900/30' :
                        cart.status === 'AI Sent' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 animate-pulse' :
                        cart.status === 'SMS Fallback' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30' :
                        'bg-neutral-900 text-neutral-500 border border-neutral-800'
                      }`}>
                        {cart.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}