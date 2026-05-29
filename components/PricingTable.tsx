'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'

type Market = 'india' | 'global'

type Plan = {
  id: string
  name: string
  price: string
  cadence: string
  features: string[]
  cta: string
  accent: string
  highlight?: 'MOST_POPULAR' | 'BEST_VALUE'
}

type Deal = { id: string; title: string; price: string; stores: string; tag?: string }

type Competitor = { tool: string; price: string; markup: string; ai: string; india: string; highlight?: boolean }

export default function PricingTable(): React.ReactElement {
  const [market, setMarket] = useState<Market>('india')

  const plans = useMemo(() => {
    return {
      india: [
        {
          id: 'in-starter',
          name: 'Starter',
          price: '₹999',
          cadence: '/month',
          features: [
            '1 Store',
            '200 Cart Recoveries / month',
            'WhatsApp + Email',
            'Basic Dashboard',
            '0% Conversation Markup',
            '14-day Free Trial',
          ],
          cta: 'Start Free Trial',
          accent: '#00C896',
        },
        {
          id: 'in-growth',
          name: 'Growth',
          price: '₹2,499',
          cadence: '/month',
          features: [
            '3 Stores',
            '1,000 Cart Recoveries / month',
            'WhatsApp + Email + SMS',
            'AI Personalized Messages',
            '0% Conversation Markup',
            'COD Verification',
            'Razorpay Payment Links',
            'Analytics Dashboard',
          ],
          cta: 'Get Started',
          accent: '#FF6B35',
          highlight: 'MOST_POPULAR',
        },
        {
          id: 'in-scale',
          name: 'Scale',
          price: '₹5,999',
          cadence: '/month',
          features: [
            'Unlimited Stores',
            'Unlimited Recoveries',
            'All Channels',
            'AI Chatbot',
            'Shiprocket Integration',
            'Priority Support',
            'Custom Templates',
            'White Label Option',
          ],
          cta: 'Go Scale',
          accent: '#7C3AED',
          highlight: 'BEST_VALUE',
        },
      ] as Plan[],
      global: [
        {
          id: 'gl-starter',
          name: 'Starter',
          price: '$19',
          cadence: '/month',
          features: [
            '1 Store',
            '200 Cart Recoveries / month',
            'WhatsApp + Email',
            'Basic Dashboard',
            '0% Conversation Markup',
            '14-day Free Trial',
          ],
          cta: 'Start Free Trial',
          accent: '#00C896',
        },
        {
          id: 'gl-growth',
          name: 'Growth',
          price: '$49',
          cadence: '/month',
          features: [
            '3 Stores',
            '1,000 Cart Recoveries / month',
            'WhatsApp + Email + SMS',
            'AI Personalized Messages',
            '0% Conversation Markup',
            'Analytics Dashboard',
            'Priority Support',
          ],
          cta: 'Get Started',
          accent: '#FF6B35',
          highlight: 'MOST_POPULAR',
        },
        {
          id: 'gl-scale',
          name: 'Scale',
          price: '$99',
          cadence: '/month',
          features: [
            'Unlimited Stores',
            'Unlimited Recoveries',
            'All Channels',
            'AI Chatbot',
            'Custom Integrations',
            'Dedicated Account Manager',
            'White Label Option',
            'SLA Guarantee',
          ],
          cta: 'Go Scale',
          accent: '#7C3AED',
          highlight: 'BEST_VALUE',
        },
      ] as Plan[],
    }
  }, [])

  const deals: Deal[] = [
    { id: 'as-single', title: 'Single', price: '$59', stores: '1 Store' },
    { id: 'as-double', title: 'Double', price: '$118', stores: '3 Stores', tag: 'POPULAR' },
    { id: 'as-multi', title: 'Multiple', price: '$177', stores: 'Unlimited', tag: 'BEST DEAL' },
  ]

  const competitors: Competitor[] = [
    { tool: 'BiteSpeed', price: '$250/mo', markup: 'Yes', ai: '✅', india: '✅' },
    { tool: 'Zoko', price: '₹3,499/mo', markup: 'Yes +₹1.25/conv', ai: '❌', india: '✅' },
    { tool: 'Wati', price: '$30/mo', markup: 'Yes', ai: '❌', india: '❌' },
    { tool: 'CartRenew', price: market === 'india' ? '₹999/mo' : '$19/mo', markup: '0% ✦', ai: '✅', india: '✅', highlight: true },
  ]

  const revenueCards = [
    { users: 50, mrr: market === 'india' ? '₹1,500' : '$1,500', percent: 7 },
    { users: 200, mrr: market === 'india' ? '₹7,000' : '$7,000', percent: 35 },
    { users: 500, mrr: market === 'india' ? '₹20,000' : '$20,000', percent: 90 },
  ]

  const timeline = [
    { step: '01', title: 'Beta', details: 'Invite-only beta with core feature set and feedback loop' },
    { step: '02', title: 'Early Bird', details: 'Open discounts and first customers onboarding' },
    { step: '03', title: 'Product Hunt', details: 'Public launch and press outreach' },
    { step: '04', title: 'AppSumo', details: 'AppSumo LTD launch with one-time deals' },
  ]

  return (
    <section className="w-full min-h-screen py-12 px-6 lg:px-12 bg-[#0A0A0F] text-slate-200">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h2 className="text-3xl lg:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7C3AED]">
            Pricing built for growth
          </h2>
          <p className="mt-2 text-slate-400">Choose a plan that fits your scale — transparent pricing, no hidden markup.</p>
        </header>

        {/* Market Toggle */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-400">Market</div>
            <div className="bg-[#13131A] p-1 rounded-full border border-[#1E1E2E] inline-flex items-center">
              <button
                aria-pressed={market === 'india'}
                onClick={() => setMarket('india')}
                className={`px-4 py-2 rounded-full transition-all text-sm font-semibold ${market === 'india' ? 'bg-[#0B1222] text-white shadow-sm' : 'text-slate-300'}`}
              >
                India
              </button>
              <button
                aria-pressed={market === 'global'}
                onClick={() => setMarket('global')}
                className={`px-4 py-2 rounded-full transition-all text-sm font-semibold ${market === 'global' ? 'bg-[#0B1222] text-white shadow-sm' : 'text-slate-300'}`}
              >
                Global
              </button>
            </div>
          </div>

          <div className="text-sm text-slate-400">Pay annually for 2 months free</div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {plans[market].map((p) => (
            <article key={p.id} className="relative rounded-2xl bg-[#13131A] border border-[#1E1E2E] p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold" style={{ WebkitTextStroke: '0.2px rgba(0,0,0,0.4)' }}>{p.name}</h3>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white">{p.price}</span>
                    <span className="text-sm text-slate-400">{p.cadence}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  {p.highlight && (
                    <span className={`text-xs font-semibold uppercase px-3 py-1 rounded-full text-black`} style={{ background: p.accent }}>
                      {p.highlight === 'MOST_POPULAR' ? 'Most Popular' : 'Best Value'}
                    </span>
                  )}

                  <div className="mt-3 w-10 h-10 rounded-full" style={{ boxShadow: `0 0 18px ${p.accent}33`, background: p.accent }} />
                </div>
              </div>

              <ul className="mt-6 space-y-2 text-sm text-slate-300">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <svg className="w-5 h-5 flex-shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                <Link href="/sign-up" className="w-full block">
                  <button
                    type="button"
                    style={{ background: p.accent }}
                    className="w-full py-3 rounded-xl text-black font-semibold hover:opacity-95 transition"
                  >
                    {p.cta}
                  </button>
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* AppSumo Deals */}
        <div className="mb-10">
          <h4 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#FF6B35]">AppSumo LTD Deals</h4>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {deals.map((d) => (
              <div key={d.id} className="rounded-xl bg-[#13131A] border border-[#1E1E2E] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-400">{d.title}</div>
                    <div className="text-lg font-bold">{d.price}</div>
                  </div>
                  {d.tag && <div className="text-xs font-bold px-2 py-1 bg-[#FF6B35] text-black rounded">{d.tag}</div>}
                </div>
                <div className="text-sm text-slate-300">{d.stores}</div>
                <Link href="/sign-up" className="mt-3 block rounded-lg bg-[#00C896] py-2 text-center text-black font-semibold hover:opacity-95 transition">
                  Buy Now
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Competitor Table */}
        <div className="mb-10 overflow-x-auto">
          <h4 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7C3AED]">Competitor Comparison</h4>
          <div className="mt-4 min-w-[720px] rounded-xl bg-[#13131A] border border-[#1E1E2E] p-4">
            <div className="grid grid-cols-5 gap-4 text-xs text-slate-400 uppercase px-3 py-2 border-b border-[#1E1E2E]">
              <div>Tool</div>
              <div>Price</div>
              <div>WA Markup</div>
              <div>AI</div>
              <div>India Stack</div>
            </div>

            <div className="divide-y divide-[#1E1E2E]">
              {competitors.map((c) => (
                <div key={c.tool} className={`grid grid-cols-5 gap-4 items-center px-3 py-4 ${c.highlight ? 'border-l-4 border-emerald-400 bg-emerald-900/10' : ''}`}>
                  <div className="font-semibold text-white">{c.tool}</div>
                  <div className="text-slate-300">{c.price}</div>
                  <div className="text-slate-300">{c.markup}</div>
                  <div className="text-slate-300">{c.ai}</div>
                  <div className="text-slate-300">{c.india}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue Projections */}
        <div className="mb-10">
          <h4 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#FF6B35]">Revenue Projections</h4>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {revenueCards.map((r) => (
              <div key={r.users} className="rounded-xl bg-[#13131A] border border-[#1E1E2E] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-400">{r.users} Users</div>
                    <div className="text-lg font-bold text-white">{r.mrr} MRR</div>
                  </div>
                  <div className="text-sm text-slate-400">Growth</div>
                </div>
                <div className="mt-3 h-3 bg-[#0f1116] rounded-full overflow-hidden border border-[#1E1E2E]">
                  <div className="h-full rounded-full" style={{ width: `${r.percent}%`, background: `linear-gradient(90deg,#00C896,#FF6B35)` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Launch Timeline */}
        <div className="mb-6">
          <h4 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#7C3AED]">Launch Strategy Timeline</h4>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {timeline.map((t) => (
              <div key={t.step} className="rounded-xl bg-[#13131A] border border-[#1E1E2E] p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0B1222] flex items-center justify-center font-bold text-white">{t.step}</div>
                  <div>
                    <div className="text-sm text-slate-400">{t.title}</div>
                    <div className="text-sm text-slate-300 mt-1">{t.details}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
