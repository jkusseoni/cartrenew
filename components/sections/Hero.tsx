"use client";

import React, { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';

// Rotating CartAssist Bot preview samples for the hero chat widget.
const CART_ASSIST_SAMPLES = [
  { name: 'Aman', product: 'Premium Hoodie', verb: 'is', url: 'cartrenew.ai/r/x9b2' },
  { name: 'Priya', product: 'Wireless Earbuds', verb: 'are', url: 'cartrenew.ai/r/p4k1' },
  { name: 'Rajesh', product: 'Mechanical Keyboard', verb: 'is', url: 'cartrenew.ai/r/k7m3' },
  { name: 'Sneha', product: 'Skincare Set', verb: 'is', url: 'cartrenew.ai/r/s5d8' },
] as const;

export default function Hero() {
  // Video Modal Control State
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  // CartAssist Bot live preview cycling state
  const [activeSample, setActiveSample] = useState(0);
  const [sampleVisible, setSampleVisible] = useState(true);

  useEffect(() => {
    const interval = window.setInterval(() => {
      // Fade out, swap content, then fade back in for a smooth transition.
      setSampleVisible(false);
      window.setTimeout(() => {
        setActiveSample((prev) => (prev + 1) % CART_ASSIST_SAMPLES.length);
        setSampleVisible(true);
      }, 280);
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  const sample = CART_ASSIST_SAMPLES[activeSample];

  return (
    <div className="w-full bg-[#0B0F17] relative overflow-hidden min-h-screen flex flex-col justify-between pb-12">
      
      {/* Premium Gradient Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-emerald-500/[0.04] to-cyan-500/[0.01] blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/[0.03] blur-[150px] rounded-full pointer-events-none -z-10" />

      {/* 🚀 HERO CONTENT CONTAINER */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-16 pt-12 md:pt-16 relative z-10">
        
        {/* Top Typography Copy Block */}
        <div className="max-w-4xl space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/30 border border-emerald-900/40 text-[10px] font-black uppercase tracking-widest text-[#00DF89]">
            <span className="w-2 h-2 rounded-full bg-[#00DF89] animate-pulse" />
            Shopify Native Recovery System
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.12]">
            Recover{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">
              68% of Abandoned Carts
            </span>{' '}
            on WhatsApp. With{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">
              0% Conversation Markup
            </span>
            .
          </h1>

          <p className="text-neutral-400 text-base sm:text-lg max-w-3xl leading-relaxed">
            Stop paying hefty agent platform fees. CartRenew connects directly to your Shopify store setup to trigger autonomous, multilingual recovery workflows straight to your customer&apos;s WhatsApp device.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <Link href="/sign-up" className="px-8 py-4 rounded-xl text-sm font-black text-neutral-950 bg-gradient-to-r from-[#00DF89] to-[#00D1FF] shadow-xl shadow-emerald-500/10 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-1">
              Start 14-Day Free Trial <span className="text-xs font-normal opacity-80">(No Card Needed)</span>
            </Link>
            
            <button 
              type="button"
              onClick={() => setIsVideoOpen(true)}
              className="px-6 py-4 rounded-xl text-sm font-bold text-neutral-200 border border-neutral-800 bg-neutral-900/20 hover:bg-neutral-900 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <span>▶</span> Watch Demo Video
            </button>
          </div>
        </div>

        {/* 📊 3. THE LIVE AUTOMATION DASHBOARD INTERACTIVE MOCKUP */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch bg-neutral-900/20 backdrop-blur-md border border-neutral-900/80 p-4 sm:p-6 rounded-3xl relative group">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/[0.01] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-3xl" />

          {/* Column A: Vertical Icon Navigation Toolbar */}
          <div className="lg:col-span-1 flex lg:flex-col justify-between items-center bg-neutral-950/60 border border-neutral-800/40 p-4 rounded-2xl lg:py-8 shadow-inner">
            <div className="flex lg:flex-col gap-6 text-neutral-500">
              <span className="text-emerald-400 font-bold text-lg cursor-pointer">🏠</span>
              <span className="hover:text-emerald-400 transition-colors text-lg cursor-pointer">💬</span>
              <span className="hover:text-emerald-400 transition-colors text-lg cursor-pointer">📈</span>
              <span className="hover:text-emerald-400 transition-colors text-lg cursor-pointer">📊</span>
              <span className="hover:text-emerald-400 transition-colors text-lg cursor-pointer">⚙️</span>
            </div>
            <div className="text-emerald-500 text-xl font-bold border-t border-neutral-800/60 pt-4 hidden lg:block animate-pulse">🟢</div>
          </div>

          {/* Column B: Metrics & AI Automation Flow Engine */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-neutral-950/40 border border-neutral-800/50 rounded-xl p-3 text-center sm:text-left">
                <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Recovered Revenue</p>
                <p className="text-base sm:text-xl font-mono font-black text-[#00DF89] mt-0.5">₹45,200</p>
              </div>
              <div className="bg-neutral-950/40 border border-neutral-800/50 rounded-xl p-3 text-center sm:text-left">
                <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">Messages Sent</p>
                <p className="text-base sm:text-xl font-mono font-black text-white mt-0.5">1,240</p>
              </div>
              <div className="bg-neutral-950/40 border border-neutral-800/50 rounded-xl p-3 text-center sm:text-left border-emerald-500/20">
                <p className="text-[10px] uppercase font-bold tracking-wider text-[#00DF89]">Recovery Rate</p>
                <p className="text-base sm:text-xl font-mono font-black text-[#00DF89] mt-0.5">68%</p>
              </div>
            </div>

            <div className="flex-1 min-h-[220px] bg-neutral-950/40 border border-neutral-800/60 rounded-2xl p-4 relative flex flex-col justify-between">
              <span className="text-[10px] font-bold text-neutral-400 tracking-wide uppercase bg-neutral-900/60 px-2.5 py-1 rounded-md self-start border border-neutral-800/30">
                AI Automation Flow
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-auto relative pt-4">
                <div className="bg-neutral-900/80 border border-neutral-800 p-2.5 rounded-lg text-center text-xs font-bold text-neutral-300">🛒 Abandoned Cart</div>
                <div className="bg-indigo-950/40 border border-indigo-500/30 p-2.5 rounded-lg text-center text-xs font-black text-indigo-400 sm:col-span-1 col-span-2">⚡ AI Message Trigger</div>
                <div className="bg-neutral-900/80 border border-neutral-800 p-2.5 rounded-lg text-center text-xs font-bold text-neutral-300">📱 WhatsApp Sent</div>
                <div className="bg-neutral-900/30 border border-neutral-800/40 p-2.5 rounded-lg text-center text-xs font-bold text-neutral-600 hidden sm:block">Channels: WA, SMS</div>
                <div className="bg-emerald-950/40 border border-emerald-500/40 p-2.5 rounded-lg text-center text-xs font-black text-[#00DF89] sm:col-span-2 col-span-2 animate-pulse">💰 Customer Recovered via Shopify Hook</div>
              </div>
            </div>
          </div>

          {/* Column C: WhatsApp ChatBot Live Interface Frame */}
          <div className="lg:col-span-4 bg-[#0c121e] border border-neutral-800/60 rounded-2xl p-4 flex flex-col justify-between min-h-[300px] shadow-2xl relative">
            <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-900/80">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-sm">🤖</div>
              <div>
                <p className="text-xs font-black text-white leading-none">CartAssist Bot</p>
                <p className="text-[9px] text-[#00DF89] font-medium mt-0.5">⚡ Shopify Flow Active</p>
              </div>
            </div>

            <div
              className={`flex-1 flex flex-col gap-3 py-4 overflow-y-auto justify-end transition-opacity duration-300 ease-in-out ${
                sampleVisible ? 'opacity-100' : 'opacity-0'
              }`}
              aria-live="polite"
            >
              <div className="bg-neutral-900/80 text-neutral-300 border border-neutral-800/40 p-3 rounded-xl rounded-tl-none text-xs max-w-[85%] self-start leading-relaxed">
                Hey <span className="text-indigo-400 font-mono">{sample.name}</span>, don&apos;t miss out! Your {sample.product} {sample.verb} waiting...
              </div>
              <div className="bg-neutral-900/80 text-neutral-300 border border-neutral-800/40 p-3 rounded-xl rounded-tl-none text-xs max-w-[85%] self-start leading-relaxed">
                Complete your order now and get an instant <span className="text-[#00DF89] font-bold">10% OFF</span>!
                <p className="text-indigo-400 mt-1 underline font-mono truncate">{sample.url}</p>
              </div>
            </div>

            <button type="button" className="w-full py-3 bg-[#00DF89] hover:bg-emerald-400 text-neutral-950 font-black text-xs rounded-xl transition-all tracking-tight shadow-md shadow-emerald-500/10">
              Finish Order Now
            </button>
          </div>
        </div>

        {/* 🤝 4. INTEGRATIONS LOGO STRIP */}
        <div className="w-full pt-8 border-t border-neutral-900/40 text-center space-y-6">
          <p className="text-lg md:text-xl font-bold tracking-wider text-center uppercase text-neutral-300 mb-8">Seamless Integrations With Industry Leaders</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-sm font-semibold text-neutral-400">
            <div className="flex items-center gap-2.5 group cursor-pointer">
              <div className="w-7 h-7 rounded-md bg-neutral-900 border border-emerald-500/30 flex items-center justify-center text-xs text-[#00DF89]">S</div>
              <span className="text-white font-bold">Shopify Native</span>
            </div>
            <div className="flex items-center gap-2.5 group cursor-pointer">
              <div className="w-7 h-7 rounded-md bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs text-white">W</div>
              <span>WooCommerce</span>
            </div>
            <div className="flex items-center gap-2.5 group cursor-pointer">
              <div className="w-7 h-7 rounded-md bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs text-white">R</div>
              <span>Razorpay Partner</span>
            </div>
            <div className="flex items-center gap-2.5 group cursor-pointer">
              <div className="w-7 h-7 rounded-md bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs text-white">M</div>
              <span>Meta Business API</span>
            </div>
          </div>
        </div>

        {/* 🎯 5. CORE VALUE PROPOSITION MATRIX */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 pb-4">
          <div className="bg-neutral-900/10 border border-neutral-900/60 p-5 rounded-xl flex items-start gap-4">
            <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-lg shadow-emerald-400/50" />
            <div className="text-left">
              <h4 className="text-sm font-bold text-white tracking-tight">Fast Onboarding Setup</h4>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">Instant integration for Shopify and official WhatsApp Business Cloud API channels in minutes.</p>
            </div>
          </div>
          <div className="bg-neutral-900/10 border border-neutral-900/60 p-5 rounded-xl flex items-start gap-4">
            <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0 shadow-lg shadow-amber-400/50" />
            <div className="text-left">
              <h4 className="text-sm font-bold text-white tracking-tight">AI Personalized Templates</h4>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">Ready-to-use localized message sequences matching custom consumer purchase intents.</p>
            </div>
          </div>
          <div className="bg-neutral-900/10 border border-neutral-900/60 p-5 rounded-xl flex items-start gap-4">
            <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shrink-0 shadow-lg shadow-cyan-400/50" />
            <div className="text-left">
              <h4 className="text-sm font-bold text-white tracking-tight">Real-Time Data Streams</h4>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">Optimize recovery flows on the fly with comprehensive, ROI-first conversion analytics.</p>
            </div>
          </div>
        </div>
      </main>

      {/* 🎯 6. PRODUCT WALKTHROUGH TOUR MODAL */}
      {isVideoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl bg-[#0D121F] border border-neutral-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl">
            
            {/* Close Button */}
            <button 
              type="button"
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center text-sm transition-colors z-10"
            >
              ✕
            </button>

            {/* Modal Content Header */}
            <div className="space-y-2 mb-8 text-left">
              <span className="text-[10px] font-mono font-black text-[#00DF89] bg-emerald-950/40 border border-emerald-900/30 px-2.5 py-1 rounded-md uppercase tracking-wider">
                Product Walkthrough
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                How CartRenew Recovers Your Revenue
              </h3>
              <p className="text-xs text-neutral-400">Our autonomous sequence activates the micro-second a checkout node drops.</p>
            </div>

            {/* 3-Step Process Map */}
            <div className="space-y-4">
              
              {/* Step 1 */}
              <div className="bg-neutral-950/40 border border-neutral-900 rounded-xl p-4 flex gap-4 items-start">
                <div className="w-7 h-7 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-900 flex items-center justify-center text-xs font-mono font-black shrink-0 mt-0.5">
                  01
                </div>
                <div className="text-left">
                  <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">Shopify Cart Abandonment Trigger</h4>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">Our zero-latency webhook instantly logs the shopper&apos;s details and dropped items without putting any load on your storefront theme speed.</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-neutral-950/40 border border-neutral-900 rounded-xl p-4 flex gap-4 items-start">
                <div className="w-7 h-7 rounded-lg bg-emerald-950 text-[#00DF89] border border-emerald-900 flex items-center justify-center text-xs font-mono font-black shrink-0 mt-0.5">
                  02
                </div>
                <div className="text-left">
                  <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">Autonomous Multilingual AI Message</h4>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">System parses customer locale data and dispatches highly specialized templates (like localized Hinglish/Hindi) via official Meta APIs with an integrated 10% discount dynamic checkout hook.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-neutral-950/40 border border-neutral-900 rounded-xl p-4 flex gap-4 items-start">
                <div className="w-7 h-7 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-900 flex items-center justify-center text-xs font-mono font-black shrink-0 mt-0.5">
                  03
                </div>
                <div className="text-left">
                  <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">Stripe Sync & Automation Stop</h4>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">As soon as the user completes the payment, our Stripe webhook triggers to mark the cart as &apos;Recovered&apos;, update dashboard logs, and halt any future follow-up reminders instantly.</p>
                </div>
              </div>

            </div>

            {/* Bottom Call to Action */}
            <div className="mt-8 pt-4 border-t border-neutral-900/60 flex justify-end">
              <button 
                type="button"
                onClick={() => setIsVideoOpen(false)}
                className="px-5 py-2.5 bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 text-xs font-black rounded-xl hover:opacity-90 transition-all"
              >
                Got It, Thanks!
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
