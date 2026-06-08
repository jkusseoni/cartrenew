"use client";

import React, { useState } from 'react';

const faqs = [
  {
    q: "Do I need my own WhatsApp Business API to use CartRenew?",
    a: "Yes, CartRenew connects directly to your official Meta WhatsApp Business API cloud channel. Don't worry if you don't have one—our onboarding setup wizard helps you deploy and configure it in less than 5 minutes."
  },
  {
    q: "What does '0% Conversation Markup' mean?",
    a: "Traditional tools like Zoko or Wati charge an extra premium platform tax on top of standard Meta API conversation rates. CartRenew completely eliminates this markup. You pay the exact base price directly to Meta, and only pay us our flat subscription tier fee."
  },
  {
    q: "Will my WhatsApp number get blocked for sending recovery texts?",
    a: "Not at all. Because we route all broadcasts entirely through official Meta green-tick compatible Cloud APIs using hyper-personalized workflows and customer-intent latency settings, your number remains 100% safe and compliant."
  },
  {
    q: "How does the autonomous Multilingual Engine work?",
    a: "Our AI analysis layer automatically scans customer checkout profiles. If a user is from India and drops out, it can automatically initiate fallback reminders in conversational Hinglish or local Hindi phrases instead of boring generic English templates, driving up to 3x higher response intent."
  },
  {
    q: "Is there any long-term locking contract?",
    a: "No contract obligations. You can upgrade, downgrade, or cancel your active subscription plan at any given time directly from your developer dashboard management portal instantly."
  }
];

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggleFAQ = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faqs" className="w-full bg-[#0B0F17] py-20 lg:py-28 relative border-b border-neutral-900/60">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        
        {/* Section Header */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-xs font-bold tracking-widest text-indigo-400 uppercase">Answering Doubts</h2>
          <p className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Frequently Asked Questions
          </p>
          <p className="text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto">
            Got questions about how CartRenew handles automated recoveries? Everything you need to know about markups, APIs, and scaling operations.
          </p>
        </div>

        {/* Accordion List Structure Wrapper */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div 
                key={idx}
                className="rounded-xl border border-neutral-900 bg-neutral-900/10 overflow-hidden transition-all duration-300 hover:border-neutral-800"
              >
                {/* Trigger Row Button Node */}
                <button
                  className="w-full p-6 flex items-center justify-between gap-4 text-left font-bold text-white text-base sm:text-lg transition-colors focus:outline-none"
                  onClick={() => toggleFAQ(idx)}
                >
                  <span>{faq.q}</span>
                  <span className={`text-xl font-mono text-indigo-400 transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}>
                    ＋
                  </span>
                </button>

                {/* Collapsible Hidden Content Layout Body */}
                <div 
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[300px] border-t border-neutral-900/60' : 'max-h-0'}`}
                >
                  <p className="p-6 text-sm sm:text-base text-neutral-400 leading-relaxed bg-neutral-950/20">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}