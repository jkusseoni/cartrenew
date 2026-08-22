"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Clock,
  MessageCircle,
  Plug,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";

const STEPS = [
  {
    num: "01",
    title: "Install Plugin",
    body: "Install CartRenew plugin on your WordPress site from WordPress.org",
  },
  {
    num: "02",
    title: "Enter Credentials",
    body: "Paste your Store ID and API Key from CartRenew dashboard",
  },
  {
    num: "03",
    title: "Recover Carts",
    body: "Customers receive WhatsApp reminders automatically when they abandon their cart",
  },
] as const;

const FEATURES = [
  {
    icon: MessageCircle,
    title: "WhatsApp Recovery",
    body: "Automated messages sent via WhatsApp",
  },
  {
    icon: ShieldCheck,
    title: "Consent-First",
    body: "Phone number captured with explicit opt-in on cart page",
  },
  {
    icon: ShoppingCart,
    title: "WooCommerce Native",
    body: "Works with classic and block-based WooCommerce cart",
  },
  {
    icon: Plug,
    title: "Easy Setup",
    body: "No coding. Plugin + credentials = done",
  },
  {
    icon: Clock,
    title: "Abandoned Cart Detection",
    body: "Detects abandonment after configurable wait time (default 20 min)",
  },
  {
    icon: BarChart3,
    title: "Dashboard Analytics",
    body: "Monitor recoveries from CartRenew dashboard",
  },
] as const;

const PLANS = [
  {
    name: "Starter",
    price: "$12",
    features: [
      "1 Store",
      "200 Cart Recoveries / month",
      "WhatsApp + Email",
      "Basic Dashboard",
      "0% Conversation Markup",
    ],
    popular: false,
  },
  {
    name: "Growth",
    price: "$29",
    features: [
      "3 Stores",
      "1,000 Cart Recoveries / month",
      "WhatsApp + Email + SMS",
      "AI Personalized Messages",
      "0% Conversation Markup",
    ],
    popular: true,
  },
  {
    name: "Scale",
    price: "$69",
    features: [
      "Unlimited Stores",
      "Unlimited Recoveries",
      "All Channels",
      "AI Chatbot",
      "Priority Support",
      "White Label Option",
    ],
    popular: false,
  },
] as const;

const FAQS = [
  {
    q: "Does this work with all WooCommerce themes?",
    a: "Yes — works with both classic and Gutenberg block-based cart templates.",
  },
  {
    q: "Do I need a WhatsApp Business account?",
    a: "No — CartRenew handles WhatsApp delivery for you.",
  },
  {
    q: "Is customer consent required?",
    a: "Yes — customers explicitly opt in on the cart page before any message is sent.",
  },
  {
    q: "What happens if a customer completes their order?",
    a: "CartRenew automatically detects the purchase and cancels any pending recovery message.",
  },
] as const;

function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-1 text-xl font-black tracking-tight">
          <span className="text-slate-900">Cart</span>
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Renew
          </span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#how-it-works"
            className="text-xs font-bold uppercase tracking-wider text-slate-600 transition-colors hover:text-blue-600"
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="text-xs font-bold uppercase tracking-wider text-slate-600 transition-colors hover:text-blue-600"
          >
            Pricing
          </a>
          <a
            href="#faq"
            className="text-xs font-bold uppercase tracking-wider text-slate-600 transition-colors hover:text-blue-600"
          >
            FAQ
          </a>
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-wider text-slate-600 transition-colors hover:text-blue-600"
          >
            Shopify
          </Link>
        </div>
        <Link
          href="/woocommerce/connect"
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-blue-500/10 transition hover:bg-blue-700"
        >
          Connect Store
        </Link>
      </div>
    </nav>
  );
}

function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {FAQS.map((faq, idx) => {
        const open = openIdx === idx;
        return (
          <div
            key={faq.q}
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm transition hover:border-blue-200"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 p-5 text-left text-sm font-bold text-slate-900 sm:text-base"
              onClick={() => setOpenIdx(open ? null : idx)}
              aria-expanded={open}
            >
              <span>{faq.q}</span>
              <span
                className={`font-mono text-lg text-blue-600 transition-transform ${
                  open ? "rotate-45" : ""
                }`}
              >
                ＋
              </span>
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                open ? "max-h-40 border-t border-slate-100" : "max-h-0"
              }`}
            >
              <p className="p-5 text-sm leading-relaxed text-slate-500">{faq.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function WooCommerceLanding() {
  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-50 text-slate-800 selection:bg-blue-200 selection:text-blue-900">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[5%] h-[900px] w-[900px] rounded-full bg-blue-100/40 blur-[160px] mix-blend-multiply" />
        <div className="absolute right-[-10%] top-[35%] h-[800px] w-[800px] rounded-full bg-pink-100/40 blur-[150px] mix-blend-multiply" />
        <div className="absolute left-[5%] top-[65%] h-[700px] w-[700px] rounded-full bg-emerald-100/30 blur-[140px] mix-blend-multiply" />
      </div>

      <LandingNav />

      <div className="relative z-10 flex w-full flex-col pt-16">
        {/* HERO */}
        <section className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-16 sm:px-6 md:pt-24 lg:px-8">
          <div className="max-w-3xl space-y-6">
            <p className="text-sm font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-600 sm:text-base">
              CartRenew for WooCommerce
            </p>
            <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Recover Abandoned Carts on WooCommerce via WhatsApp
            </h1>
            <p className="max-w-2xl text-base font-medium leading-relaxed text-slate-500 sm:text-lg md:text-xl">
              Send automated WhatsApp reminders to customers who leave items in
              their cart. Set up in minutes, no coding required.
            </p>
            <div className="flex flex-col items-stretch gap-4 pt-2 sm:flex-row sm:items-center">
              <Link
                href="/woocommerce/connect"
                className="flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-8 py-4 text-sm font-black text-white shadow-xl shadow-blue-500/20 transition hover:opacity-95"
              >
                Connect Your Store →
              </Link>
              <Link
                href="/"
                className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                View Shopify version
              </Link>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          id="how-it-works"
          className="border-t border-slate-200/60 bg-white/40 px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-2xl space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                How it works
              </p>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Live in three steps
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {STEPS.map((step) => (
                <div
                  key={step.num}
                  className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm"
                >
                  <span className="font-mono text-xs font-black text-blue-600">
                    {step.num}
                  </span>
                  <h3 className="mt-3 text-lg font-black text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-2xl space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                Features
              </p>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Built for WooCommerce merchants
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <h3 className="mt-4 text-base font-black text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                      {feature.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section
          id="pricing"
          className="border-t border-slate-200/60 bg-white/50 px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 max-w-2xl space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                Pricing
              </p>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Same plans as Shopify
              </h2>
              <p className="text-sm font-bold text-emerald-700">
                14-day free trial on all plans
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`flex flex-col rounded-3xl border p-6 sm:p-8 ${
                    plan.popular
                      ? "border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-500/10"
                      : "border-slate-200 bg-white/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                      {plan.name}
                    </h3>
                    {plan.popular ? (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                        Most popular
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 font-mono text-4xl font-black text-slate-900">
                    {plan.price}
                    <span className="text-sm font-bold text-slate-400">/mo</span>
                  </p>
                  <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-600">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="font-black text-emerald-600">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/woocommerce/connect"
                    className={`mt-8 block rounded-xl py-3.5 text-center text-xs font-black transition ${
                      plan.popular
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/15 hover:opacity-95"
                        : "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-white"
                    }`}
                  >
                    Get Started Free
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-10 space-y-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                FAQ
              </p>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Frequently asked questions
              </h2>
            </div>
            <FaqAccordion />
          </div>
        </section>

        {/* FOOTER CTA */}
        <section className="border-t border-slate-200/60 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-10 text-center shadow-sm">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Ready to recover lost revenue?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-slate-500">
              Generate your Store ID and API key, install the plugin, and start
              recovering abandoned WooCommerce carts on WhatsApp.
            </p>
            <Link
              href="/woocommerce/connect"
              className="mt-8 inline-flex rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-8 py-4 text-sm font-black text-white shadow-xl shadow-blue-500/20 transition hover:opacity-95"
            >
              Connect WooCommerce Store
            </Link>
          </div>
        </section>

        <footer className="border-t border-slate-200/80 bg-white/60 py-8 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
            <div className="text-center sm:text-left">
              <span className="text-lg font-black tracking-wider text-slate-900">
                CartRenew
              </span>
              <p className="text-xs text-slate-400">
                © {new Date().getFullYear()} All rights reserved.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-bold text-slate-500">
              <Link href="/en/privacy" className="hover:text-slate-900">
                Privacy
              </Link>
              <Link href="/en/terms" className="hover:text-slate-900">
                Terms
              </Link>
              <Link href="/en/support" className="hover:text-slate-900">
                Support
              </Link>
              <Link href="/" className="text-indigo-600 hover:text-indigo-500">
                Shopify version
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
