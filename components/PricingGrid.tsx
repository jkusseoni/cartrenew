"use client";import React from 'react';
import { Check } from 'lucide-react'; // Make sure to run: npm i lucide-react

const tiers = [
  {
    name: 'Starter LTD',
    price: '$99',
    description: 'Perfect for early-stage single storefronts looking to automate basic recovery paths.',
    features: [
      '1 Storefront integration',
      'Up to 500 automated recovery sessions/mo',
      'Dynamic multi-lingual routing',
      'Vercel & Supabase edge latency handling',
      'Email support via contact@cartrenew.com',
    ],
    buttonText: 'Get Lifetime Access',
    popular: false,
    checkoutUrl: "https://rzp.io/rzp/6LhjxROW",
    paypalUrl: "https://www.paypal.com/paypalme/yourprofile/99USD",
  },
  {
    name: 'Growth LTD',
    price: '$199',
    description: 'Designed for scaling e-commerce brands targeting international US/EU markets.',
    features: [
      '3 Storefront integrations',
      'Unlimited recovery sessions',
      'Priority AI WhatsApp personalization',
      'Advanced cross-border analytics dashboard',
      '24/7 Priority developer support',
      'Lifetime system core updates',
    ],
    buttonText: 'Get Growth Access',
    popular: true,
    checkoutUrl: "https://rzp.io/rzp/pU7Y7xTj",
    paypalUrl: "https://www.paypal.com/paypalme/yourprofile/199USD",
  },
  {
    name: 'Agency LTD',
    price: '$399',
    description: 'Best for agency owners and developers managing multiple merchant clients globally.',
    features: [
      'Unlimited storefront integrations',
      'Unlimited recovery sessions',
      'Full white-label branding configurations',
      'Dedicated database cluster allocations',
      'Direct WhatsApp API infrastructure link',
      'Dedicated partner manager access',
    ],
    buttonText: 'Get Agency Access',
    popular: false,
    checkoutUrl: "https://rzp.io/rzp/emdA9Lmk",
  },
];

export default function PricingGrid() {
  return (
    <section className="bg-neutral-900 py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-base font-semibold text-indigo-400 tracking-wide uppercase">Pricing</h2>
          <p className="mt-2 text-4xl font-extrabold text-white sm:text-5xl tracking-tight">
            Lifetime Deals, No Monthly Fees
          </p>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-neutral-400">
            Lock in grandfathered access to CartRenew’s automated AI cart recovery pipeline today.
          </p>
        </div>

        {/* Grid Container */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className={`relative flex flex-col justify-between bg-neutral-800/40 rounded-2xl p-8 backdrop-blur-sm border transition-all duration-300 hover:translate-y-[-4px] ${
                tier.popular
                  ? 'border-indigo-500 shadow-xl shadow-indigo-500/10 scale-105 md:scale-105'
                  : 'border-neutral-700/60 hover:border-neutral-600'
              }`}
            >
              {tier.popular && (
                <span className="absolute top-0 right-6 transform -translate-y-1/2 bg-indigo-500 text-white text-xs font-semibold tracking-wider uppercase px-3 py-1 rounded-full shadow-md">
                  Most Popular
                </span>
              )}

              <div>
                {/* Tier Name & Price */}
                <h3 className="text-xl font-bold text-white tracking-tight">{tier.name}</h3>
                <p className="mt-4 flex items-baseline text-white">
                  <span className="text-5xl font-extrabold tracking-tight">{tier.price}</span>
                  <span className="ml-1 text-xl font-semibold text-neutral-400">/one-time</span>
                </p>
                <p className="mt-4 text-sm text-neutral-400 leading-relaxed">{tier.description}</p>

                {/* Divider */}
                <div className="my-6 border-t border-neutral-700/50" />

                {/* Features List */}
                <ul className="space-y-4">
                  {tier.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start text-neutral-300 text-sm">
                      <div className="flex-shrink-0 mt-0.5">
                        <Check className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                      </div>
                      <span className="ml-3">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="mt-8">
                <button
  onClick={() => {
    if (tier.checkoutUrl) {
      window.location.href = tier.checkoutUrl;
    }
  }}
  className={`w-full py-3 px-4 rounded-xl text-sm font-semibold tracking-wide transition-all
    ${tier.popular
      ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-200'
      : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-100'
    }`}
>
  {tier.buttonText}
</button>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}