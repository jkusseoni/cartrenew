import React from 'react';
import Link from 'next/link';

export default function RefundPolicy() {
  return (
    <main className="min-h-screen bg-[#0B0F17] text-neutral-300 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8 bg-neutral-900/20 border border-neutral-900 p-8 sm:p-12 rounded-2xl backdrop-blur-md">
        
        <div>
          <Link href="/" className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Back to Home
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-4">Refund & Cancellation Policy</h1>
          <p className="text-xs text-neutral-500 mt-2">Last updated: June 5, 2026</p>
        </div>

        <div className="space-y-6 text-sm sm:text-base leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">1. Subscription Cancellations</h2>
            <p>E-commerce merchants can cancel their CartRenew SaaS subscription at any time directly through their automated dashboard billing settings. Upon cancellation, your service profile will remain active until the conclusion of your current paid billing cycle.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">2. Refund Eligibility</h2>
            <p>We want you to be completely satisfied with our platform. We offer a 14-day refund window from the date of your initial plan deployment or Lifetime Deal (LTD) purchase. If the system does not meet your business integration requirements, you may request a full refund within this timeframe.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">3. Processing Fees and Exceptions</h2>
            <p>Refund requests submitted after the 14-day validation period are generally non-refundable due to reserved backend server allocations. Any refunds processed will be credited back via the original international cross-border payment gateway mechanism used during checkout.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">4. Requesting a Refund</h2>
            <p>To initiate a dynamic cancellation review or check refund status, please submit a formal technical request from your registered developer account email directly to: <span className="text-indigo-400 font-mono">contact@cartrenew.com</span>.</p>
          </section>
        </div>

      </div>
    </main>
  );
}