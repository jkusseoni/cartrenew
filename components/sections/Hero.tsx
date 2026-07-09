"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

const CART_ASSIST_SAMPLES = [
  { name: "Aman", product: "Premium Hoodie", verb: "is", url: "cartrenew.ai/r/x9b2" },
  { name: "Priya", product: "Wireless Earbuds", verb: "are", url: "cartrenew.ai/r/p4k1" },
  { name: "Rajesh", product: "Mechanical Keyboard", verb: "is", url: "cartrenew.ai/r/k7m3" },
  { name: "Sneha", product: "Skincare Set", verb: "is", url: "cartrenew.ai/r/s5d8" },
] as const;

export default function Hero() {
  const t = useTranslations("hero");
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [activeSample, setActiveSample] = useState(0);
  const [sampleVisible, setSampleVisible] = useState(true);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSampleVisible(false);
      window.setTimeout(() => {
        setActiveSample((prev) => (prev + 1) % CART_ASSIST_SAMPLES.length);
        setSampleVisible(true);
      }, 280);
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  const sample = CART_ASSIST_SAMPLES[activeSample];

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-transparent pb-12 font-sans antialiased">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[700px] w-[700px] rounded-full bg-blue-100/50 blur-[150px] mix-blend-multiply" />
        <div className="absolute right-[-10%] top-[15%] h-[600px] w-[600px] rounded-full bg-pink-100/40 blur-[130px] mix-blend-multiply" />
        <div className="absolute bottom-[-5%] right-[10%] h-[550px] w-[550px] rounded-full bg-emerald-50/50 blur-[140px] mix-blend-multiply" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000003_1px,transparent_1px),linear-gradient(to_bottom,#00000003_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 pt-20 sm:px-6 md:pt-24 lg:px-8">
        <div className="max-w-4xl space-y-6 text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            {t("badge")}
          </div>

          <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl">
            {t("headline", { percent: "68%" })}
          </h1>

          <p className="max-w-3xl text-base font-medium leading-relaxed text-slate-500 sm:text-lg md:text-xl">
            {t("description")}
          </p>

          <div className="flex flex-col items-stretch gap-4 pt-2 sm:flex-row sm:items-center">
            <Link
              href="/sign-up"
              className="flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-8 py-4 text-sm font-black text-white shadow-xl shadow-blue-500/20 transition-all hover:opacity-95"
            >
              {t("ctaTrial")}{" "}
              <span className="pl-1 text-xs font-normal opacity-90">{t("ctaNoCard")}</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsVideoOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
            >
              <span className="text-blue-600" aria-hidden="true">
                ▶
              </span>
              {t("ctaDemo")}
            </button>
          </div>
        </div>

        {/* Live automation dashboard + CartAssist bot */}
        <div className="group relative grid w-full grid-cols-1 items-stretch gap-5 rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-xl shadow-slate-200/30 backdrop-blur-xl sm:p-6 lg:grid-cols-12">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50 p-4 shadow-inner lg:col-span-1 lg:flex-col lg:py-8">
            <div className="flex gap-6 text-lg text-slate-400 lg:flex-col">
              <span className="cursor-pointer font-bold text-blue-600">⌂</span>
              <span className="cursor-pointer transition-colors hover:text-blue-600">💬</span>
              <span className="cursor-pointer transition-colors hover:text-blue-600">📈</span>
              <span className="cursor-pointer transition-colors hover:text-blue-600">📊</span>
              <span className="cursor-pointer transition-colors hover:text-blue-600">⚙</span>
            </div>
            <div className="mt-4 hidden animate-pulse border-t border-slate-200 pt-4 text-sm font-bold text-emerald-500 lg:block">
              ●
            </div>
          </div>

          <div className="flex min-h-[280px] flex-col gap-5 lg:col-span-7">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-4 text-center shadow-sm sm:text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Recovered Revenue
                </p>
                <p className="mt-0.5 font-mono text-base font-black text-emerald-600 sm:text-xl">
                  ₹45,200
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-4 text-center shadow-sm sm:text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Messages Sent
                </p>
                <p className="mt-0.5 font-mono text-base font-black text-slate-800 sm:text-xl">
                  1,240
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-center shadow-sm sm:text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  {t("statRecoveryRate")}
                </p>
                <p className="mt-0.5 font-mono text-base font-black text-emerald-600 sm:text-xl">
                  68%
                </p>
              </div>
            </div>

            <div className="relative flex min-h-[220px] flex-1 flex-col justify-between rounded-2xl border border-slate-200/60 bg-slate-50 p-6 shadow-inner">
              <span className="self-start rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 shadow-sm">
                AI Automation Flow
              </span>

              <div className="my-auto grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-center text-xs font-bold text-slate-600 shadow-sm">
                  🛒 Abandoned Cart
                </div>
                <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-center text-xs font-black text-blue-600 shadow-sm sm:col-span-1">
                  ⚡ AI Message Trigger
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-center text-xs font-bold text-slate-600 shadow-sm">
                  📱 WhatsApp Sent
                </div>
                <div className="hidden rounded-lg border border-slate-200/40 bg-slate-100/50 p-3 text-center text-xs font-semibold text-slate-400 sm:block">
                  Channels: WA, SMS
                </div>
                <div className="col-span-2 animate-pulse rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center text-xs font-black text-emerald-600 shadow-sm sm:col-span-2">
                  💰 Customer Recovered
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[300px] flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50 p-5 shadow-inner lg:col-span-4">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm">
                🤖
              </div>
              <div>
                <p className="text-xs font-black leading-none text-slate-800">CartAssist Bot</p>
                <p className="mt-0.5 text-[9px] font-bold text-blue-600">⚡ Shopify Flow Active</p>
              </div>
            </div>

            <div
              className={`flex flex-1 flex-col justify-end gap-3 py-4 transition-all duration-300 ${
                sampleVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
              }`}
            >
              <div className="max-w-[85%] self-start rounded-xl rounded-tl-none border border-slate-200/80 bg-white p-3 text-xs leading-relaxed text-slate-700 shadow-sm">
                Hey <span className="font-mono font-bold text-blue-600">{sample.name}</span>,
                don&apos;t miss out! Your {sample.product} {sample.verb} waiting...
              </div>
              <div className="max-w-[85%] self-start rounded-xl rounded-tl-none border border-slate-200/80 bg-white p-3 text-xs leading-relaxed text-slate-700 shadow-sm">
                Complete your order now and get an instant{" "}
                <span className="font-bold text-emerald-600">10% OFF</span>!
                <p className="mt-1 truncate font-mono text-blue-600 underline">{sample.url}</p>
              </div>
            </div>

            <button
              type="button"
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs font-black text-white shadow-md shadow-blue-500/20 transition-all hover:opacity-95"
            >
              Finish Order Now
            </button>
          </div>
        </div>

        <div className="w-full space-y-6 border-t border-slate-200/80 pt-8 text-center">
          <p className="mb-8 text-center text-xs font-black uppercase tracking-widest text-slate-400 md:text-sm">
            Seamless Integrations With Industry Leaders
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-sm font-bold text-slate-500">
            {[
              { letter: "S", label: "Shopify Native", color: "text-blue-500" },
              { letter: "W", label: "WooCommerce", color: "text-slate-700" },
              { letter: "R", label: "Razorpay Partner", color: "text-slate-700" },
              { letter: "M", label: "Meta Business API", color: "text-slate-700" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex cursor-pointer items-center gap-2.5 transition-colors hover:text-slate-800"
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black shadow-sm ${item.color}`}
                >
                  {item.letter}
                </div>
                <span className={item.letter === "S" ? "text-slate-700" : undefined}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {isVideoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setIsVideoOpen(false)}
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm text-slate-400 shadow-sm transition-colors hover:text-slate-800"
              aria-label="Close demo"
            >
              ✕
            </button>
            <div className="mb-6 space-y-2 text-left">
              <span className="rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-wider text-blue-600 shadow-sm">
                Product Walkthrough
              </span>
              <h3 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                How CartRenew Recovers Your Revenue
              </h3>
            </div>
            <div className="space-y-3 text-left text-xs text-slate-600 sm:text-sm">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <b className="text-blue-600">01. Shopify Trigger:</b> Webhook logs dropped items
                instantly.
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <b className="text-indigo-600">02. AI Message:</b> Sends highly customized WhatsApp
                templates via official Meta APIs.
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <b className="text-emerald-600">03. Stop Hook:</b> Halts reminders as soon as order
                completes.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
