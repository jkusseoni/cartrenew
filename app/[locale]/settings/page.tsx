"use client";

import React, { use, useState } from 'react';
import Link from 'next/link';
import { Link as LocaleLink } from '@/i18n/routing';

import {
  isValid,
  validateEmail,
  validateNumericId,
  validateRequired,
  validateShopifyDomain,
  type FieldError,
} from '@/lib/validation';

type SettingsErrors = {
  shopifyDomain: FieldError;
  whatsappPhoneId: FieldError;
  shiprocketEmail: FieldError;
  shiprocketPassword: FieldError;
};

const NO_ERRORS: SettingsErrors = {
  shopifyDomain: null,
  whatsappPhoneId: null,
  shiprocketEmail: null,
  shiprocketPassword: null,
};

export default function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  use(params);
  // Mock states for key configuration parameters
  const [shopifyDomain, setShopifyDomain] = useState("cartrenew-test-store.myshopify.com");
  const [whatsappPhoneId, setWhatsappPhoneId] = useState("9755612850"); // Verified active phone connection node
  const [shiprocketEmail, setShiprocketEmail] = useState("contact@cartrenew.com");
  const [shiprocketPassword, setShiprocketPassword] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [errors, setErrors] = useState<SettingsErrors>(NO_ERRORS);

  // Validate every field before "saving"; block submission on any error.
  const handleSaveConfigs = (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: SettingsErrors = {
      shopifyDomain: validateShopifyDomain(shopifyDomain),
      whatsappPhoneId: validateNumericId(whatsappPhoneId, "WhatsApp Phone Number ID"),
      shiprocketEmail: validateEmail(shiprocketEmail),
      shiprocketPassword: validateRequired(shiprocketPassword, "ShipRocket password"),
    };

    setErrors(nextErrors);
    if (!isValid(nextErrors)) {
      setIsSaved(false);
      return;
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Small helper to render an inline error message beneath a field.
  const FieldErrorText = ({ error }: { error: FieldError }) =>
    error ? <p className="text-[11px] font-bold text-red-400 mt-1">{error}</p> : null;

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col lg:flex-row">
      
      {/* 🧭 SIDEBAR NAVIGATION (Completely synchronized with Dashboard & Marketing Hub) */}
      <aside className="w-full lg:w-64 bg-neutral-950 border-b lg:border-b-0 lg:border-r border-neutral-900 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight">
              Cart<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">Renew</span>
            </span>
            <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">v0.1</span>
          </div>

          <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 text-xs font-bold text-neutral-400">
            <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full">
              <span>🏠</span> Dashboard Summary
            </Link>
            <Link href="/marketing-hub" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full">
              <span>💬</span> Automation Workflows
            </Link>
            <Link href="/analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full">
              <span>📈</span> ROI Analytics
            </Link>
            <Link href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900 text-[#00DF89] border border-neutral-800/40 shrink-0 lg:w-full">
              <span>⚙️</span> Core Integration Settings
            </Link>
            <LocaleLink href="/woocommerce/connect" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full">
              <span>🛒</span> WooCommerce
            </LocaleLink>
          </nav>
        </div>

        <div className="pt-4 border-t border-neutral-900 hidden lg:flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm">👤</div>
            <div>
              <p className="text-xs font-black text-neutral-200 leading-none">Merchant Account</p>
              <p className="text-[9px] text-neutral-500 font-mono mt-1">ID: Pro-Active</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 🛠️ CONFIGURATION CONTROL BOARD */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto max-w-5xl">
        
        {/* Header Section */}
        <div className="flex items-center justify-between border-b border-neutral-900/60 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">System Settings</h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">Configure production API connections and synchronize webhooks securely.</p>
          </div>
        </div>

        <form onSubmit={handleSaveConfigs} className="space-y-6">
          
          {/* 🛍️ SECTION A: SHOPIFY WEBHOOK SYNC BLOCKS */}
          <div className="bg-neutral-950/40 border border-neutral-900 rounded-2xl p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#00D1FF] flex items-center gap-2">
              <span>🛍️</span> Shopify Store Nodes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400">Shopify Custom myshopify.com Domain</label>
                <input 
                  type="text"
                  value={shopifyDomain}
                  onChange={(e) => setShopifyDomain(e.target.value)}
                  aria-invalid={Boolean(errors.shopifyDomain)}
                  className={`w-full bg-neutral-900/60 border rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none font-mono ${errors.shopifyDomain ? 'border-red-800 focus:border-red-500' : 'border-neutral-800 focus:border-[#00DF89]'}`}
                />
                <FieldErrorText error={errors.shopifyDomain} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400">Admin GraphQL Access Token</label>
                <input 
                  type="password"
                  value="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled
                  className="w-full bg-neutral-900/30 border border-neutral-900 rounded-xl px-4 py-3 text-xs sm:text-sm text-neutral-600 focus:outline-none cursor-not-allowed font-mono"
                />
              </div>
            </div>
          </div>

          {/* 💬 SECTION B: META / WHATSAPP BUSINESS API KEY SETS */}
          <div className="bg-neutral-950/40 border border-neutral-900 rounded-2xl p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#00DF89] flex items-center gap-2">
              <span>💬</span> Meta Cloud API Gateway
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400">WhatsApp Phone Number ID</label>
                <input 
                  type="text"
                  inputMode="numeric"
                  value={whatsappPhoneId}
                  onChange={(e) => setWhatsappPhoneId(e.target.value)}
                  aria-invalid={Boolean(errors.whatsappPhoneId)}
                  className={`w-full bg-neutral-900/60 border rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none font-mono ${errors.whatsappPhoneId ? 'border-red-800 focus:border-red-500' : 'border-neutral-800 focus:border-[#00DF89]'}`}
                />
                <FieldErrorText error={errors.whatsappPhoneId} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400">Meta Permanent System User Token</label>
                <input 
                  type="password"
                  value="EAAlKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled
                  className="w-full bg-neutral-900/30 border border-neutral-900 rounded-xl px-4 py-3 text-xs sm:text-sm text-neutral-600 focus:outline-none cursor-not-allowed font-mono"
                />
              </div>
            </div>
          </div>

          {/* 🚀 SECTION C: SHIPROCKET CREDENTIAL BLOCKS */}
          <div className="bg-neutral-950/40 border border-neutral-900 rounded-2xl p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-neutral-500 flex items-center gap-2">
              <span>🚀</span> ShipRocket Shipping Hub
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400">ShipRocket Registered Email Account</label>
                <input 
                  type="email"
                  value={shiprocketEmail}
                  onChange={(e) => setShiprocketEmail(e.target.value)}
                  aria-invalid={Boolean(errors.shiprocketEmail)}
                  className={`w-full bg-neutral-900/60 border rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none font-mono ${errors.shiprocketEmail ? 'border-red-800 focus:border-red-500' : 'border-neutral-800 focus:border-[#00DF89]'}`}
                />
                <FieldErrorText error={errors.shiprocketEmail} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400">ShipRocket Integration API Password</label>
                <input 
                  type="password"
                  value={shiprocketPassword}
                  onChange={(e) => setShiprocketPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.shiprocketPassword)}
                  className={`w-full bg-neutral-900/60 border rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none font-mono ${errors.shiprocketPassword ? 'border-red-800 focus:border-red-500' : 'border-neutral-800 focus:border-[#00DF89]'}`}
                />
                <FieldErrorText error={errors.shiprocketPassword} />
              </div>
            </div>
          </div>

          {/* Master Form Execution Area */}
          <div className="flex items-center gap-4 pt-4">
            <button 
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-[#00DF89] to-[#00D1FF] text-neutral-950 text-xs font-black rounded-xl hover:opacity-95 transition-all active:scale-[0.98]"
            >
              Save Configuration Logs
            </button>
            {isSaved && (
              <span className="text-xs font-bold text-[#00DF89] animate-fade-in flex items-center gap-1.5">
                ✓ Environment variable hooks updated successfully!
              </span>
            )}
          </div>

        </form>

      </main>
    </div>
  );
}