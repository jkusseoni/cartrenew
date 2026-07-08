"use client";

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { motion } from 'framer-motion';

const CART_ASSIST_SAMPLES = [
  { name: 'Aman', product: 'Premium Hoodie', verb: 'is', url: 'cartrenew.ai/r/x9b2' },
  { name: 'Priya', product: 'Wireless Earbuds', verb: 'are', url: 'cartrenew.ai/r/p4k1' },
  { name: 'Rajesh', product: 'Mechanical Keyboard', verb: 'is', url: 'cartrenew.ai/r/k7m3' },
  { name: 'Sneha', product: 'Skincare Set', verb: 'is', url: 'cartrenew.ai/r/s5d8' },
] as const;

export default function Hero() {
  const t = useTranslations('hero');
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [activeSample, setActiveSample] = useState(0);
  const [sampleVisible, setSampleVisible] = useState(true);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSampleVisible(false);
      window.setTimeout(() => {
        setActiveSample((prev) => (prev + 1) % CART_ASSIST_SAMPLES.length);
        setSampleVisible(true);
      }, 280);
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  const sample = CART_ASSIST_SAMPLES[activeSample];

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    // 🌸 सॉफ़्ट लाइट थीम कंटेनर - bg-[#030712] हटाकर पूरी तरह से ट्रांसपेरेंट किया
    <div className="w-full bg-transparent relative overflow-hidden min-h-screen flex flex-col justify-between pb-12 font-sans antialiased">
      
      {/* 🌟 COMPLETE HIGH-VISIBILITY LIGHT AMBIENT GLOW WEB */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* लाइट थीम के अनुकूल सॉफ़्ट ग्लो लाइट्स */}
        <div className="absolute -top-[10%] -left-[10%] w-[700px] h-[700px] bg-blue-100/50 blur-[150px] rounded-full mix-blend-multiply" />
        <div className="absolute top-[15%] right-[-10%] w-[600px] h-[600px] bg-pink-100/40 blur-[130px] rounded-full mix-blend-multiply" />
        <div className="absolute bottom-[-5%] right-[10%] w-[550px] h-[550px] bg-emerald-50/50 blur-[140px] rounded-full mix-blend-multiply" />
        
        {/* क्लीन लाइट ग्रिड लाइन्स */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000003_1px,transparent_1px),linear-gradient(to_bottom,#00000003_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      {/* 🚀 HERO CONTENT CONTAINER */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-12 pt-20 md:pt-24 relative z-10">
        
        {/* Top Typography Copy Block */}
        <motion.div 
          initial="hidden" 
          animate="visible" 
          variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
          className="max-w-4xl space-y-6 text-left"
        >
          <motion.div 
            variants={fadeInUp}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-black uppercase tracking-widest text-blue-600 shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Shopify Native Recovery System
          </motion.div>

          {/* 🎯 टेक्स्ट कलर text-white से बदलकर text-slate-900 किया ताकि साफ़ दिखे */}
          <motion.h1 
            variants={fadeInUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.1]"
          >
            Recover{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-600">
              68% of Abandoned Carts
            </span>{' '}
            on WhatsApp.
          </motion.h1>

          <motion.p 
            variants={fadeInUp}
            className="text-slate-500 text-base sm:text-lg md:text-xl max-w-3xl leading-relaxed font-medium"
          >
            {t('description')}
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <Link href="/sign-up" className="px-8 py-4 rounded-xl text-sm font-black text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 shadow-xl shadow-blue-500/20 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-1">
              Start 14-Day Free Trial <span className="text-xs font-normal opacity-90 pl-1">(No Card Needed)</span>
            </Link>
            
            <button 
              type="button"
              onClick={() => setIsVideoOpen(true)}
              className="px-6 py-4 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm"
            >
              <span className="text-blue-600">▶</span> Watch Demo Video
            </button>
          </motion.div>
        </motion.div>

        {/* 📊 THE LIVE AUTOMATION DASHBOARD INTERACTIVE MOCKUP - Clean Glassmorphism */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch border border-slate-200/80 bg-white/80 p-4 sm:p-6 rounded-3xl relative group backdrop-blur-xl shadow-xl shadow-slate-200/30"
        >
          {/* Column A: Vertical Icon Navigation Toolbar */}
          <div className="lg:col-span-1 flex lg:flex-col justify-between items-center bg-slate-50 border border-slate-200/60 p-4 rounded-2xl lg:py-8 shadow-inner">
            <div className="flex lg:flex-col gap-6 text-slate-400">
              <span className="text-blue-600 font-bold text-lg cursor-pointer">🏠</span>
              <span className="hover:text-blue-600 transition-colors text-lg cursor-pointer">💬</span>
              <span className="hover:text-blue-600 transition-colors text-lg cursor-pointer">📈</span>
              <span className="hover:text-blue-600 transition-colors text-lg cursor-pointer">📊</span>
              <span className="hover:text-blue-600 transition-colors text-lg cursor-pointer">⚙️</span>
            </div>
            <div className="text-emerald-500 text-sm font-bold border-t border-slate-200 pt-4 hidden lg:block animate-pulse">🟢</div>
          </div>

          {/* Column B: Metrics & AI Automation Flow Engine */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-center sm:text-left shadow-sm">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Recovered Revenue</p>
                <p className="text-base sm:text-xl font-mono font-black text-emerald-600 mt-0.5">₹45,200</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-center sm:text-left shadow-sm">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Messages Sent</p>
                <p className="text-base sm:text-xl font-mono font-black text-slate-800 mt-0.5">1,240</p>
              </div>
              <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 text-center sm:text-left shadow-sm">
                <p className="text-[10px] uppercase font-bold tracking-wider text-blue-600">Recovery Rate</p>
                <p className="text-base sm:text-xl font-mono font-black text-emerald-600 mt-0.5">68%</p>
              </div>
            </div>

            <div className="flex-1 min-h-[220px] bg-slate-50 border border-slate-200/60 rounded-2xl p-6 relative flex flex-col justify-between shadow-inner">
              <span className="text-[10px] font-bold text-slate-500 tracking-wide uppercase bg-white px-2.5 py-1 rounded-md self-start border border-slate-200 shadow-sm">
                AI Automation Flow
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-auto pt-4">
                <div className="bg-white border border-slate-200 p-3 rounded-lg text-center text-xs font-bold text-slate-600 shadow-sm">🛒 Abandoned Cart</div>
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-center text-xs font-black text-blue-600 sm:col-span-1 col-span-2 shadow-sm">⚡ AI Message Trigger</div>
                <div className="bg-white border border-slate-200 p-3 rounded-lg text-center text-xs font-bold text-slate-600 shadow-sm">📱 WhatsApp Sent</div>
                <div className="bg-slate-100/50 border border-slate-200/40 p-3 rounded-lg text-center text-xs font-semibold text-slate-400 hidden sm:block">Channels: WA, SMS</div>
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center text-xs font-black text-emerald-600 sm:col-span-2 col-span-2 animate-pulse shadow-sm">💰 Customer Recovered</div>
              </div>
            </div>
          </div>

          {/* Column C: WhatsApp ChatBot Live Interface Frame */}
          <div className="lg:col-span-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between min-h-[300px] shadow-inner relative">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">🤖</div>
              <div>
                <p className="text-xs font-black text-slate-800 leading-none">CartAssist Bot</p>
                <p className="text-[9px] text-blue-600 font-bold mt-0.5">⚡ Shopify Flow Active</p>
              </div>
            </div>

            <div
              className={`flex-1 flex flex-col gap-3 py-4 justify-end transition-all duration-300 ${
                sampleVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
            >
              <div className="bg-white text-slate-700 border border-slate-200/80 p-3 rounded-xl rounded-tl-none text-xs max-w-[85%] self-start leading-relaxed shadow-sm">
                Hey <span className="text-blue-600 font-mono font-bold">{sample.name}</span>, don&apos;t miss out! Your {sample.product} {sample.verb} waiting...
              </div>
              <div className="bg-white text-slate-700 border border-slate-200/80 p-3 rounded-xl rounded-tl-none text-xs max-w-[85%] self-start leading-relaxed shadow-sm">
                Complete your order now and get an instant <span className="text-emerald-600 font-bold">10% OFF</span>!
                <p className="text-blue-600 mt-1 underline font-mono truncate">{sample.url}</p>
              </div>
            </div>

            <button type="button" className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-blue-500/20 hover:opacity-95">
              Finish Order Now
            </button>
          </div>
        </motion.div>

        {/* 🤝 INTEGRATIONS LOGO STRIP */}
        <div className="w-full pt-8 border-t border-slate-200/80 text-center space-y-6">
          <p className="text-xs md:text-sm font-black tracking-widest text-center uppercase text-slate-400 mb-8">Seamless Integrations With Industry Leaders</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-sm font-bold text-slate-500">
            <div className="flex items-center gap-2.5 cursor-pointer hover:text-slate-800 transition-colors">
              <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-blue-500 shadow-sm">S</div>
              <span className="text-slate-700">Shopify Native</span>
            </div>
            <div className="flex items-center gap-2.5 cursor-pointer hover:text-slate-800 transition-colors">
              <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700 shadow-sm">W</div>
              <span>WooCommerce</span>
            </div>
            <div className="flex items-center gap-2.5 cursor-pointer hover:text-slate-800 transition-colors">
              <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700 shadow-sm">R</div>
              <span>Razorpay Partner</span>
            </div>
            <div className="flex items-center gap-2.5 cursor-pointer hover:text-slate-800 transition-colors">
              <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700 shadow-sm">M</div>
              <span>Meta Business API</span>
            </div>
          </div>
        </div>

      </main>

      {/* PRODUCT WALKTHROUGH TOUR MODAL */}
      {isVideoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <button 
              type="button"
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-800 flex items-center justify-center text-sm transition-colors shadow-sm"
            >
              ✕
            </button>
            <div className="space-y-2 mb-6 text-left">
              <span className="text-[10px] font-mono font-black text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">
                Product Walkthrough
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">How CartRenew Recovers Your Revenue</h3>
            </div>
            <div className="space-y-3 text-slate-600 text-xs sm:text-sm text-left">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl"><b className="text-blue-600">01. Shopify Trigger:</b> Webhook logs dropped items instantly.</div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl"><b className="text-indigo-600">02. AI Message:</b> Sends highly customized WhatsApp templates via official Meta APIs.</div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl"><b className="text-emerald-600">03. Stop Hook:</b> Halts reminders as soon as order completes.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}