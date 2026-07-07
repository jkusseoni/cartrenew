"use client";

import React, { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { motion } from 'framer-motion';

const CART_ASSIST_SAMPLES = [
  { name: 'Aman', product: 'Premium Hoodie', verb: 'is', url: 'cartrenew.ai/r/x9b2' },
  { name: 'Priya', product: 'Wireless Earbuds', verb: 'are', url: 'cartrenew.ai/r/p4k1' },
  { name: 'Rajesh', product: 'Mechanical Keyboard', verb: 'is', url: 'cartrenew.ai/r/k7m3' },
  { name: 'Sneha', product: 'Skincare Set', verb: 'is', url: 'cartrenew.ai/r/s5d8' },
] as const;

export default function Hero() {
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
    <div className="w-full bg-[#030712] relative overflow-hidden min-h-screen flex flex-col justify-between pb-12 font-sans antialiased">
      
      {/* 🌟 COMPLETE HIGH-VISIBILITY AMBIENT GLOW WEB */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* टॉप लेफ्ट: ब्राइट रॉयल ब्लू ग्लो जो ब्लैकनेस को खत्म करेगा */}
        <div className="absolute -top-[10%] -left-[10%] w-[700px] h-[700px] bg-blue-600/25 blur-[160px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
        
        {/* सेंटर राइट: प्रीमियम इंडीगो/वायलेट लाइट जो सीधे टेक्स्ट के पीछे रिफ्लेक्ट होगी */}
        <div className="absolute top-[15%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/20 blur-[140px] rounded-full mix-blend-screen" />
        
        {/* मिडिल लेफ्ट: सॉफ्ट सयान टच */}
        <div className="absolute top-[45%] left-[-5%] w-[500px] h-[500px] bg-cyan-500/15 blur-[130px] rounded-full mix-blend-screen" />
        
        {/* बॉटम राइट: लाइट एवेराल्ड ग्रीन बेस */}
        <div className="absolute bottom-[-5%] right-[10%] w-[550px] h-[550px] bg-emerald-500/10 blur-[150px] rounded-full mix-blend-screen" />
        
        {/* सब्टल ग्रिड ओवरले ताकि बैकग्राउंड में प्रीमियम टेक टेक्सचर आए */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* 🚀 HERO CONTENT CONTAINER */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-16 pt-16 md:pt-20 relative z-10">
        
        {/* Top Typography Copy Block */}
        <motion.div 
          initial="hidden" 
          animate="visible" 
          variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
          className="max-w-4xl space-y-6 text-left"
        >
          <motion.div 
            variants={fadeInUp}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-400 backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Shopify Native Recovery System
          </motion.div>

          <motion.h1 
            variants={fadeInUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1]"
          >
            Recover{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400">
              68% of Abandoned Carts
            </span>{' '}
            on WhatsApp.
          </motion.h1>

          <motion.p 
            variants={fadeInUp}
            className="text-slate-400 text-base sm:text-lg md:text-xl max-w-3xl leading-relaxed"
          >
            बिना किसी मानवीय हस्तक्षेप के, AI-संचालित व्हाट्सएप संदेशों के जरिए छूटे हुए कट्स को रिकवर करें और अपने स्टोर की बिक्री को आसमान पर ले जाएं।
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <Link href="/sign-up" className="px-8 py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-1">
              Start 14-Day Free Trial <span className="text-xs font-normal opacity-80 pl-1">(No Card Needed)</span>
            </Link>
            
            <button 
              type="button"
              onClick={() => setIsVideoOpen(true)}
              className="px-6 py-4 rounded-xl text-sm font-bold text-slate-300 border border-slate-800 bg-slate-900/40 backdrop-blur-md hover:bg-slate-900 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <span>▶</span> Watch Demo Video
            </button>
          </motion.div>
        </motion.div>

        {/* 📊 THE LIVE AUTOMATION DASHBOARD INTERACTIVE MOCKUP */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch border border-white/10 bg-slate-950/40 p-4 sm:p-6 rounded-3xl relative group backdrop-blur-xl shadow-2xl shadow-black/50"
        >
          {/* Column A: Vertical Icon Navigation Toolbar */}
          <div className="lg:col-span-1 flex lg:flex-col justify-between items-center bg-white/5 border border-white/10 p-4 rounded-2xl lg:py-8 shadow-inner backdrop-blur-md">
            <div className="flex lg:flex-col gap-6 text-slate-500">
              <span className="text-blue-400 font-bold text-lg cursor-pointer">🏠</span>
              <span className="hover:text-blue-400 transition-colors text-lg cursor-pointer">💬</span>
              <span className="hover:text-blue-400 transition-colors text-lg cursor-pointer">📈</span>
              <span className="hover:text-blue-400 transition-colors text-lg cursor-pointer">📊</span>
              <span className="hover:text-blue-400 transition-colors text-lg cursor-pointer">⚙️</span>
            </div>
            <div className="text-emerald-500 text-xl font-bold border-t border-white/10 pt-4 hidden lg:block animate-pulse">🟢</div>
          </div>

          {/* Column B: Metrics & AI Automation Flow Engine */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center sm:text-left backdrop-blur-md">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Recovered Revenue</p>
                <p className="text-base sm:text-xl font-mono font-black text-emerald-400 mt-0.5">₹45,200</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center sm:text-left backdrop-blur-md">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Messages Sent</p>
                <p className="text-base sm:text-xl font-mono font-black text-white mt-0.5">1,240</p>
              </div>
              <div className="bg-white/5 border border-blue-500/30 rounded-xl p-4 text-center sm:text-left backdrop-blur-md bg-blue-500/5">
                <p className="text-[10px] uppercase font-bold tracking-wider text-blue-400">Recovery Rate</p>
                <p className="text-base sm:text-xl font-mono font-black text-emerald-400 mt-0.5">68%</p>
              </div>
            </div>

            <div className="flex-1 min-h-[220px] bg-white/5 border border-white/10 rounded-2xl p-6 relative flex flex-col justify-between backdrop-blur-md">
              <span className="text-[10px] font-bold text-slate-300 tracking-wide uppercase bg-white/10 px-2.5 py-1 rounded-md self-start border border-white/10">
                AI Automation Flow
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-auto pt-4">
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-center text-xs font-semibold text-slate-300">🛒 Abandoned Cart</div>
                <div className="bg-blue-950/50 border border-blue-500/40 p-3 rounded-lg text-center text-xs font-black text-blue-400 sm:col-span-1 col-span-2">⚡ AI Message Trigger</div>
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-center text-xs font-semibold text-slate-300">📱 WhatsApp Sent</div>
                <div className="bg-slate-900/30 border border-slate-800/40 p-3 rounded-lg text-center text-xs font-semibold text-slate-600 hidden sm:block">Channels: WA, SMS</div>
                <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-lg text-center text-xs font-black text-emerald-400 sm:col-span-2 col-span-2 animate-pulse">💰 Customer Recovered</div>
              </div>
            </div>
          </div>

          {/* Column C: WhatsApp ChatBot Live Interface Frame */}
          <div className="lg:col-span-4 bg-[#090d1a] border border-white/10 rounded-2xl p-5 flex flex-col justify-between min-h-[300px] shadow-2xl relative">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-sm">🤖</div>
              <div>
                <p className="text-xs font-black text-white leading-none">CartAssist Bot</p>
                <p className="text-[9px] text-blue-400 font-medium mt-0.5">⚡ Shopify Flow Active</p>
              </div>
            </div>

            <div
              className={`flex-1 flex flex-col gap-3 py-4 justify-end transition-all duration-300 ${
                sampleVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
            >
              <div className="bg-white/5 text-slate-300 border border-white/10 p-3 rounded-xl rounded-tl-none text-xs max-w-[85%] self-start leading-relaxed">
                Hey <span className="text-blue-400 font-mono font-bold">{sample.name}</span>, don&apos;t miss out! Your {sample.product} {sample.verb} waiting...
              </div>
              <div className="bg-white/5 text-slate-300 border border-white/10 p-3 rounded-xl rounded-tl-none text-xs max-w-[85%] self-start leading-relaxed">
                Complete your order now and get an instant <span className="text-emerald-400 font-bold">10% OFF</span>!
                <p className="text-blue-400 mt-1 underline font-mono truncate">{sample.url}</p>
              </div>
            </div>

            <button type="button" className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-500/10 hover:opacity-90">
              Finish Order Now
            </button>
          </div>
        </motion.div>

        {/* 🤝 INTEGRATIONS LOGO STRIP */}
        <div className="w-full pt-8 border-t border-white/5 text-center space-y-6">
          <p className="text-xs md:text-sm font-bold tracking-widest text-center uppercase text-slate-400 mb-8">Seamless Integrations With Industry Leaders</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-sm font-semibold text-slate-400">
            <div className="flex items-center gap-2.5 cursor-pointer hover:text-white transition-colors">
              <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-blue-400">S</div>
              <span className="text-slate-200">Shopify Native</span>
            </div>
            <div className="flex items-center gap-2.5 cursor-pointer hover:text-white transition-colors">
              <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold">W</div>
              <span>WooCommerce</span>
            </div>
            <div className="flex items-center gap-2.5 cursor-pointer hover:text-white transition-colors">
              <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold">R</div>
              <span>Razorpay Partner</span>
            </div>
            <div className="flex items-center gap-2.5 cursor-pointer hover:text-white transition-colors">
              <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold">M</div>
              <span>Meta Business API</span>
            </div>
          </div>
        </div>

      </main>

      {/* PRODUCT WALKTHROUGH TOUR MODAL */}
      {isVideoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-2xl bg-[#090d1a] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <button 
              type="button"
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors"
            >
              ✕
            </button>
            <div className="space-y-2 mb-6 text-left">
              <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-md uppercase tracking-wider">
                Product Walkthrough
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">How CartRenew Recovers Your Revenue</h3>
            </div>
            <div className="space-y-3 text-slate-300 text-xs sm:text-sm text-left">
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl"><b className="text-blue-400">01. Shopify Trigger:</b> Webhook logs dropped items instantly.</div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl"><b className="text-indigo-400">02. AI Message:</b> Sends highly customized WhatsApp templates via official Meta APIs.</div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl"><b className="text-emerald-400">03. Stop Hook:</b> Halts reminders as soon as order completes.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}