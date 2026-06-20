"use client";

import { Link } from '@/i18n/routing';
import LanguageSelector from '@/components/LanguageSelector';

export default function Navbar() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 w-full border-b border-neutral-900/60 bg-[#0B0F17]/80 backdrop-blur-md transition-all duration-300">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-[#00DF89] to-[#00D1FF] shadow-lg shadow-emerald-500/10">
            <span className="text-xs font-black text-neutral-950">CR</span>
          </div>
          <span className="text-sm font-black uppercase tracking-wider text-white transition-colors group-hover:text-[#00DF89]">
            CartRenew
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-xs font-black text-neutral-400">
          <Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/#comparison" className="hover:text-white transition-colors">Comparison</Link>
          <Link href="/#dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <Link href="/#docs" className="hover:text-white transition-colors">Docs</Link>
        </nav>

        <div className="flex items-center gap-4">
          <LanguageSelector />

          <Link
            href="/sign-in"
            className="px-2 py-1.5 text-xs font-black text-neutral-400 transition hover:text-white"
          >
            Sign In
          </Link>

          <Link
            href="/sign-in"
            className="rounded-xl bg-gradient-to-r from-[#00DF89] to-[#00D1FF] px-4 py-2 text-xs font-black text-neutral-950 shadow-md shadow-emerald-500/5 transition hover:opacity-95 active:scale-[0.98]"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </header>
  );
}
