// app/[locale]/privacy/page.tsx
import React from 'react';
import Link from 'next/link';
import { Link as LocaleLink } from '@/i18n/routing';

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
          <p className="text-xs text-neutral-500 mt-2">Last updated: October 2, 2026</p>
        </div>

        {/* पॉलिसी कंटेंट */}
        <div className="space-y-6 text-sm sm:text-base leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">1. Introduction</h2>
            <p>Welcome to CartRenew (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We operate cartrenew.com, an automated B2B SaaS system that helps e-commerce merchants recover abandoned carts. We respect your privacy and are committed to protecting any personal data processed through our application.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">2. Information We Collect</h2>
            <p>We collect information to provide better services to all of our users, including:</p>
            <ul className="list-disc pl-5 space-y-2 text-neutral-400">
              <li><strong className="text-neutral-200">Account Data:</strong> Name, professional email address, and billing information when you subscribe to our services.</li>
              <li><strong className="text-neutral-200">Integration Data:</strong> E-commerce store metrics, abandoned checkout timestamps, and dynamically routed customer transaction links necessary for core cart recovery functions.</li>
              <li><strong className="text-neutral-200">Shopper Data (collected on behalf of merchants):</strong> Customer name, phone number, email address (if provided), and cart contents and checkout link, received from the merchant&apos;s Shopify or WooCommerce store. The phone number is used for WhatsApp recovery messages only when the shopper has given consent at checkout.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">3. How We Use Information</h2>
            <p>We process information to:</p>
            <ul className="list-disc pl-5 space-y-2 text-neutral-400">
              <li>Send cart reminders to shoppers via the WhatsApp Business Platform (Meta Cloud API) on behalf of the merchant.</li>
              <li>Show the merchant the delivery status of those reminders (sent, delivered, read or not delivered).</li>
              <li>Run our multi-lingual cart recovery workflows, process subscription billing, keep the service stable and secure, and provide customer support.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">4. Consent and Opt-out</h2>
            <p>Recovery messages are intended only for shoppers who have consented to receive WhatsApp messages at checkout. Merchants are responsible for collecting this consent before enabling CartRenew, as required by our Terms of Service.</p>
            <p>Shoppers who no longer want to receive reminders can email <a href="mailto:contact@cartrenew.com" className="text-blue-400 hover:underline font-mono">contact@cartrenew.com</a> with the phone number the reminder was sent to, and we will stop further reminders to that number.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">5. Data Sharing</h2>
            <p>We do not sell personal data. We only share information with the service providers we use to run CartRenew:</p>
            <ul className="list-disc pl-5 space-y-2 text-neutral-400">
              <li><strong className="text-neutral-200">Meta Platforms:</strong> the WhatsApp Business Platform (Cloud API) receives the shopper&apos;s phone number, name and checkout link to deliver reminders, and reports delivery status back to us. We also use the Meta Conversions API to measure our own advertising on cartrenew.com.</li>
              <li><strong className="text-neutral-200">Vercel:</strong> application hosting and website analytics.</li>
              <li><strong className="text-neutral-200">Supabase:</strong> database hosting.</li>
              <li><strong className="text-neutral-200">Clerk:</strong> merchant account sign-in.</li>
              <li><strong className="text-neutral-200">PayPal and Shopify Billing:</strong> subscription payments.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">6. Data Retention</h2>
            <p>Shopper data is retained while the merchant&apos;s account is active and deleted on request or when the account is closed. Merchant account data is retained only as long as the account remains active.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">7. Data Deletion</h2>
            <p>Merchants and shoppers can request deletion of their data at any time, without logging in. See our <LocaleLink href="/data-deletion" className="text-blue-400 hover:underline">Data Deletion</LocaleLink> page for instructions. Requests are handled within 30 days.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">8. No Affiliation</h2>
            <p>CartRenew is not affiliated with or endorsed by WhatsApp or Meta.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">9. Contact Us</h2>
            <p>If you have any questions regarding this Privacy Policy, please reach out to our administration team directly at: <a href="mailto:contact@cartrenew.com" className="text-blue-400 hover:underline font-mono">contact@cartrenew.com</a>.</p>
          </section>
        </div>

      </div>
    </main>
  );
}
