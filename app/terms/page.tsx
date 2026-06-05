import React from 'react';

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-neutral-900 text-neutral-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-neutral-800/50 rounded-2xl p-8 backdrop-blur-sm border border-neutral-700/50 shadow-xl">
        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Terms of Service</h1>
        <p className="text-sm text-neutral-400 mb-8">Last updated: June 5, 2026</p>

        <div className="space-y-6 text-neutral-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using CartRenew (cartrenew.com), you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a business entity, you represent that you have the authority to bind such entity to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Service Description and Deployment</h2>
            <p>
              CartRenew provides automated cloud-based B2B recovery systems utilizing Next.js workflows. Services are deployed over production clusters to help merchants manage abandoned checkout sequences. You are responsible for ensuring your store setup complies with local consumer communication laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Subscriptions and Fees</h2>
            <p>
              Accounts are billed on a subscription basis or via authorized Lifetime Deals (LTD). All recurring fees, structural billing processing, and international cross-border transactions are initiated securely through third-party clearance systems.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, CartRenew shall not be liable for any indirect, incidental, or consequential damages, including loss of profits, data, or e-commerce merchant revenues resulting from system downtimes or automated workflow adjustments.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Termination</h2>
            <p>
              We reserve the right to suspend or terminate access to our services immediately, without prior notice or liability, for any breach of these contractual terms.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}