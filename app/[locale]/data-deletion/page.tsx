import React from 'react';
import Link from 'next/link';
import { brand } from '@/lib/brand';

export default function DataDeletion() {
  return (
    <main className="min-h-screen bg-[#060913] text-neutral-300 py-16 px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="max-w-4xl mx-auto space-y-8 bg-slate-950/40 border border-white/5 p-8 sm:p-12 rounded-2xl backdrop-blur-md">

        <div className="border-b border-white/5 pb-6">
          <Link href="/en" className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2">
            ← Back to Home
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-4">Data Deletion</h1>
          <p className="text-xs text-neutral-500 mt-2">Last updated: October 2, 2026</p>
        </div>

        <div className="space-y-6 text-sm sm:text-base leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">1. Your Right to Deletion</h2>
            <p>You can ask {brand.name} to delete the personal data we hold about you at any time. No account or login is required to make a request.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">2. Store Owners</h2>
            <p>If you are a merchant using {brand.name}, email <a href={`mailto:${brand.supportEmail}`} className="text-blue-400 hover:underline font-mono">{brand.supportEmail}</a> from the address linked to your account, and include your store domain. We will delete your account data, store connection details and the abandoned cart records collected for your store.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">3. Customers of a Store</h2>
            <p>If you received a cart reminder from a store that uses {brand.name}, email <a href={`mailto:${brand.supportEmail}`} className="text-blue-400 hover:underline font-mono">{brand.supportEmail}</a> with the phone number or email address the reminder was sent to and, if you know it, the store&apos;s name. We will delete your cart and message records and stop any further reminders to you.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">4. Processing Time</h2>
            <p>We confirm receipt of your request and complete the deletion within 30 days. We may need to keep limited records where the law requires it, such as billing and tax records.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">5. Contact Us</h2>
            <p>For any question about your data, see our <Link href="/en/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link> or write to <a href={`mailto:${brand.supportEmail}`} className="text-blue-400 hover:underline font-mono">{brand.supportEmail}</a>.</p>
          </section>
        </div>

      </div>
    </main>
  );
}
