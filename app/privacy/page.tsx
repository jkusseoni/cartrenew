import React from 'react';

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-neutral-900 text-neutral-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-neutral-800/50 rounded-2xl p-8 backdrop-blur-sm border border-neutral-700/50 shadow-xl">
        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-neutral-400 mb-8">Last updated: June 5, 2026</p>

        <div className="space-y-6 text-neutral-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              Welcome to CartRenew ("we," "our," or "us"). We operate cartrenew.com, an automated B2B SaaS system that helps e-commerce merchants recover abandoned carts. We respect your privacy and are committed to protecting any personal data processed through our application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            <p className="mb-2">We collect information to provide better services to our users, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-neutral-200">Account Data:</strong> Name, professional email address, and billing information when you subscribe.</li>
              <li><strong className="text-neutral-200">Integration Data:</strong> E-commerce store metrics, abandoned checkout timestamps, and dynamically routed customer transaction links necessary for cart recovery functions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Information</h2>
            <p>
              We process information to execute our multi-lingual cart recovery workflows, handle billing through international payment operators like Stripe, improve system stability on Vercel and Supabase production architectures, and provide operational support.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Sharing and Retention</h2>
            <p>
              We do not sell your personal data. We only share information with trusted infrastructure sub-processors (such as our database hosts and payment systems) necessary to complete automated recovery tasks. Data is retained as long as your account remains active.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Contact Us</h2>
            <p>
              If you have any questions regarding this Privacy Policy, please reach out to our administration team directly at: <span className="text-indigo-400 font-medium">contact@cartrenew.com</span>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}