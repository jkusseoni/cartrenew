import React from 'react';

export default function RefundPolicy() {
  return (
    <main className="min-h-screen bg-neutral-900 text-neutral-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-neutral-800/50 rounded-2xl p-8 backdrop-blur-sm border border-neutral-700/50 shadow-xl">
        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Refund & Cancellation Policy</h1>
        <p className="text-sm text-neutral-400 mb-8">Last updated: June 5, 2026</p>

        <div className="space-y-6 text-neutral-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Subscription Cancellations</h2>
            <p>
              E-commerce merchants can cancel their CartRenew SaaS subscription at any time directly through their automated dashboard billing settings. Upon cancellation, your service profile will remain active until the conclusion of your current paid billing cycle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Refund Eligibility</h2>
            <p>
              We want you to be completely satisfied with our platform. We offer a <strong className="text-neutral-200">14-day refund window</strong> from the date of your initial plan deployment or Lifetime Deal (LTD) purchase. If the system does not meet your business integration requirements, you may request a full refund within this timeframe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Processing Fees and Exceptions</h2>
            <p>
              Refund requests submitted after the 14-day validation period are generally non-refundable due to reserved backend server allocations. Any refunds processed will be credited back via the original international cross-border payment gateway mechanism used during checkout.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Requesting a Refund</h2>
            <p>
              To initiate a dynamic cancellation review or check refund status, please submit a formal technical request from your registered developer account email directly to: <span className="text-indigo-400 font-medium">contact@cartrenew.com</span>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}