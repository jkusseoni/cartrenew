import React from 'react';
import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full shrink-0 bg-neutral-950 border-t border-neutral-800 text-neutral-400 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto flex flex-col items-center justify-between gap-y-6 md:flex-row">
        
        <div className="flex flex-col items-center gap-1 text-center md:flex-row md:gap-x-2 md:text-left">
          <span className="text-white font-bold text-lg tracking-wider">
            CartRenew
          </span>
          <p className="text-sm text-neutral-500">
            © {currentYear} All rights reserved.
          </p>
        </div>

        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium md:justify-end"
        >
          <Link 
            href="/privacy" 
            className="whitespace-nowrap px-1 py-1 hover:text-white transition-colors duration-200"
          >
            Privacy Policy
          </Link>
          
          <Link 
            href="/terms" 
            className="whitespace-nowrap px-1 py-1 hover:text-white transition-colors duration-200"
          >
            Terms of Service
          </Link>
          
          <Link 
            href="/refund" 
            className="whitespace-nowrap px-1 py-1 hover:text-white transition-colors duration-200"
          >
            Refund Policy
          </Link>

          <a 
            href="mailto:contact@cartrenew.com" 
            className="whitespace-nowrap px-1 py-1 hover:text-white text-indigo-400 transition-colors duration-200"
          >
            Contact Support
          </a>
        </nav>

      </div>
    </footer>
  );
}
