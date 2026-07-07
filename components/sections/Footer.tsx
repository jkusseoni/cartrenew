"use client";

import React, { useEffect, useRef } from 'react';
import { Link } from '@/i18n/routing';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!footerRef.current) return;
    
    gsap.fromTo(
      footerRef.current,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: footerRef.current,
          start: "top 90%",
        }
      }
    );
  }, []);

  return (
    <footer ref={footerRef} className="w-full bg-neutral-950 border-t border-neutral-900 py-8 mt-12 shrink-0 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Left Section: Brand & Copyright */}
        <div className="flex flex-col items-center sm:items-start gap-1 text-center sm:text-left">
          <span className="text-white font-bold text-lg tracking-wider">
            CartRenew
          </span>
          {/* 🎯 Fixed: suppressHydrationWarning laga diya taaki Next.js background text logs standard check bypass karein */}
          <p className="text-sm text-neutral-500" suppressHydrationWarning>
            © {currentYear} All rights reserved.
          </p>
        </div>

        {/* Right Section: Legal & Mailto Active Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-neutral-400">
          <Link href="/privacy" className="hover:text-neutral-100 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-neutral-100 transition-colors">
            Terms of Service
          </Link>
          <Link href="/refund" className="hover:text-neutral-100 transition-colors">
            Refund Policy
          </Link>
          <a href="mailto:contact@cartrenew.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Contact Support
          </a>
        </div>

      </div>
    </footer>
  );
}