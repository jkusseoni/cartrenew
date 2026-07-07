// app/[locale]/privacy/page.tsx
import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[#060913] text-neutral-300 py-16 px-4 sm:px-6 lg:px-8 relative z-10">
      {/* 🌟 प्रीमियम ग्लासमोर्फिज़्म कंटेनर */}
      <div className="max-w-4xl mx-auto space-y-8 bg-slate-950/40 border border-white/5 p-8 sm:p-12 rounded-2xl backdrop-blur-md">
        
        {/* हेडर सेक्शन */}
        <div className="border-b border-white/5 pb-6">
          <Link href="/en" className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2">
            ← Back to Home
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-4">Privacy Policy</h1>
          <p className="text-xs text-neutral-500 mt-2">Last updated: June 5, 2026</p>
        </div>

        {/* पॉलिसी कंटेंट */}
        <div className="space-y-6 text-sm sm:text-base leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">1. Introduction</h2>
            <p>Welcome to CartRenew ("we," "our," or "us"). We operate cartrenew.com, an automated B2B SaaS system that helps e-commerce merchants recover abandoned carts. We respect your privacy and are committed to protecting any personal data processed through our application.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">2. Information We Collect</h2>
            <p>We collect information to provide better services to all of our users, including:</p>
            <ul className="list-disc pl-5 space-y-2 text-neutral-400">
              <li><strong className="text-neutral-200">Account Data:</strong> Name, professional email address, and billing information when you subscribe to our services.</li>
              <li><strong className="text-neutral-200">Integration Data:</strong> E-commerce store metrics, abandoned checkout timestamps, and dynamically routed customer transaction links necessary for core cart recovery functions.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">3. How We Use Information</h2>
            <p>We process information to execute our multi-lingual cart recovery workflows, handle billing through international payment operators like Stripe, improve system stability on Vercel and Supabase production architectures, and provide operational customer support.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">4. Data Sharing and Retention</h2>
            <p>We do not sell your personal data. We only share information with trusted infrastructure sub-processors (such as our database hosts and payment systems) necessary to complete automated recovery tasks. Data is retained only as long as your account remains active.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">5. Contact Us</h2>
            <p>If you have any questions regarding this Privacy Policy, please reach out to our administration team directly at: <a href="mailto:contact@cartrenew.com" className="text-blue-400 hover:underline font-mono">contact@cartrenew.com</a>.</p>
          </section>
        </div>

      </div>
    </main>
  );
}