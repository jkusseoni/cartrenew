import React from 'react';
import Link from 'next/link';

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-[#0B0F17] text-neutral-300 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8 bg-neutral-900/20 border border-neutral-900 p-8 sm:p-12 rounded-2xl backdrop-blur-md">
        
        <div>
          <Link href="/" className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Back to Home
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-4">Terms of Service</h1>
          <p className="text-xs text-neutral-500 mt-2">Last updated: June 5, 2026</p>
        </div>

        <div className="space-y-6 text-sm sm:text-base leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">1. Agreement to Terms</h2>
            <p>By accessing or using CartRenew (cartrenew.com), you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a business entity, you represent that you have the authority to bind such entity to these terms.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">2. Service Description and Deployment</h2>
            <p>CartRenew provides automated cloud-based B2B recovery systems utilizing Next.js workflows. Services are deployed over production clusters to help merchants manage abandoned checkout sequences. You are responsible for ensuring your store setup complies with local consumer communication laws.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">3. Subscriptions and Fees</h2>
            <p>Accounts are billed on a subscription basis or via authorized Lifetime Deals (LTD). All recurring fees, structural billing processing, and international cross-border transactions are initiated securely through third-party clearance systems.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">4. Limitation of Liability</h2>
            <p>To the maximum extent permitted by applicable law, CartRenew shall not be liable for any indirect, incidental, or consequential damages, including loss of profits, data, or e-commerce merchant revenues resulting from system downtimes or automated workflow adjustments.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">5. Termination</h2>
            <p>We reserve the right to suspend or terminate access to our services immediately, without prior notice or liability, for any breach of these contractual terms.</p>
          </section>
        </div>

      </div>
    </main>
  );
}