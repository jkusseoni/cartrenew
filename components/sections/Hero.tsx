"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import gsap from 'gsap';

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
  const sectionRef = useRef<HTMLDivElement>(null);

  // GSAP Animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.fromTo(".hero-animate", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.15 });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  // Sample Switcher
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSample((prev) => (prev + 1) % CART_ASSIST_SAMPLES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const sample = CART_ASSIST_SAMPLES[activeSample];

  return (
    <div ref={sectionRef} className="w-full bg-transparent relative overflow-hidden min-h-screen flex flex-col justify-between pb-12 font-sans antialiased">
      {/* Background Glows */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[700px] h-[700px] bg-blue-100/50 blur-[150px] rounded-full mix-blend-multiply" />
        <div className="absolute top-[15%] right-[-10%] w-[600px] h-[600px] bg-pink-100/40 blur-[130px] rounded-full mix-blend-multiply" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000003_1px,transparent_1px),linear-gradient(to_bottom,#00000003_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-12 pt-20 md:pt-24 relative z-10">
        
        <div className="max-w-4xl space-y-6 text-left">
          <div className="hero-animate inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-black uppercase tracking-widest text-blue-600 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Shopify Native Recovery System
          </div>

          <h1 className="hero-animate text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.1]">
            Recover <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-600">68% of Abandoned Carts</span> on WhatsApp.
          </h1>

          <p className="hero-animate text-slate-500 text-base sm:text-lg md:text-xl max-w-3xl leading-relaxed font-medium">
            {t('description')}
          </p>

          <div className="hero-animate flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <Link href="/sign-up" className="px-8 py-4 rounded-xl text-sm font-black text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 shadow-xl shadow-blue-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-1">
              Start 14-Day Free Trial <span className="text-xs font-normal opacity-90 pl-1">(No Card Needed)</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}