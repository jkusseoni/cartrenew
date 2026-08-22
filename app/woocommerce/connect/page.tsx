"use client";

import { useState } from "react";
import Link from "next/link";

type Step = 1 | 2 | 3;

type Credentials = {
  store_id: string;
  api_key: string;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="shrink-0 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-neutral-300 transition hover:border-[#00DF89]/40 hover:text-[#00DF89]"
      aria-label={`Copy ${label}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const items: { n: Step; label: string }[] = [
    { n: 1, label: "Connect" },
    { n: 2, label: "Credentials" },
    { n: 3, label: "Install plugin" },
  ];

  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
      {items.map((item, index) => {
        const active = step === item.n;
        const done = step > item.n;
        return (
          <li key={item.n} className="flex items-center gap-2 sm:gap-3">
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                active
                  ? "border-[#00DF89]/50 bg-[#00DF89]/10 text-[#00DF89]"
                  : done
                    ? "border-neutral-700 bg-neutral-900 text-neutral-300"
                    : "border-neutral-800 bg-neutral-950 text-neutral-500"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  active || done
                    ? "bg-[#00DF89] text-neutral-950"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {done ? "✓" : item.n}
              </span>
              {item.label}
            </div>
            {index < items.length - 1 ? (
              <span className="hidden text-neutral-700 sm:inline">→</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export default function WooCommerceConnectPage() {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingStoreId, setExistingStoreId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExistingStoreId(null);
    setLoading(true);

    try {
      const res = await fetch("/api/woocommerce/register-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          site_url: siteUrl.trim(),
          store_name: storeName.trim() || undefined,
        }),
      });

      const json = (await res.json().catch(() => null)) as {
        store_id?: string;
        api_key?: string;
        error?: string;
      } | null;

      if (res.status === 409 && json?.store_id) {
        setExistingStoreId(json.store_id);
        setError(
          "This site is already registered. Use your existing Store ID in the plugin — the API key is not shown again."
        );
        return;
      }

      if (!res.ok || !json?.store_id || !json?.api_key) {
        setError(json?.error || "Could not generate credentials. Try again.");
        return;
      }

      setCredentials({ store_id: json.store_id, api_key: json.api_key });
      setStep(2);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col lg:flex-row">
      <aside className="w-full lg:w-64 bg-neutral-950 border-b lg:border-b-0 lg:border-r border-neutral-900 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight">
              Cart
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00DF89] to-[#00D1FF]">
                Renew
              </span>
            </span>
            <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
              Woo
            </span>
          </div>

          <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 text-xs font-bold text-neutral-400">
            <Link
              href="/en/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full"
            >
              <span>🏠</span> Dashboard
            </Link>
            <Link
              href="/en/settings"
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-900/40 hover:text-white transition-colors shrink-0 lg:w-full"
            >
              <span>⚙️</span> Settings
            </Link>
            <a href="/woocommerce" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900 text-[#00DF89] border border-neutral-800/40 shrink-0 lg:w-full">
              <span>🛒</span> WooCommerce
            </a>
          </nav>
        </div>

        <p className="hidden lg:block text-[10px] text-neutral-600 font-mono pt-4 border-t border-neutral-900">
          Public onboarding — no login required
        </p>
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto max-w-3xl">
        <div className="border-b border-neutral-900/60 pb-6 space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Connect WooCommerce
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Generate Store ID + API key, then paste them into the CartRenew WordPress plugin.
            </p>
          </div>
          <StepIndicator step={step} />
        </div>

        {step === 1 ? (
          <form onSubmit={(e) => void handleGenerate(e)} className="space-y-5">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5 sm:p-6 space-y-4">
              <h2 className="text-sm font-black text-white">Connect your WooCommerce store</h2>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@store.com"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-[#00DF89]/50"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                  WordPress site URL
                </span>
                <input
                  type="url"
                  required
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://yourstore.com"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-[#00DF89]/50"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                  Store name <span className="normal-case text-neutral-600">(optional)</span>
                </span>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Daily Tech Khabar"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-[#00DF89]/50"
                />
              </label>

              {error ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 space-y-1">
                  <p>{error}</p>
                  {existingStoreId ? (
                    <p className="font-mono text-[11px] text-amber-100/80">
                      Store ID: {existingStoreId}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto rounded-xl bg-[#00DF89] px-5 py-3 text-xs font-black text-neutral-950 transition hover:bg-[#00c978] disabled:opacity-60"
              >
                {loading ? "Generating…" : "Generate credentials"}
              </button>
            </div>
          </form>
        ) : null}

        {step === 2 && credentials ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-sm font-black text-white">Your credentials</h2>
              <p className="mt-1 text-xs text-amber-300/90">
                Save the API key now — it will not be shown again.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-2">
                  Store ID
                </p>
                <div className="flex items-start gap-3">
                  <code className="flex-1 break-all font-mono text-xs text-[#00D1FF]">
                    {credentials.store_id}
                  </code>
                  <CopyButton value={credentials.store_id} label="Store ID" />
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-400/80 mb-2">
                  API Key
                </p>
                <div className="flex items-start gap-3">
                  <code className="flex-1 break-all font-mono text-xs text-amber-100">
                    {credentials.api_key}
                  </code>
                  <CopyButton value={credentials.api_key} label="API Key" />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-xl bg-[#00DF89] px-5 py-3 text-xs font-black text-neutral-950 transition hover:bg-[#00c978]"
            >
              Next: Install plugin →
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5 sm:p-6 space-y-5">
            <h2 className="text-sm font-black text-white">Install CartRenew plugin</h2>
            <ol className="space-y-3 text-sm text-neutral-300 list-decimal list-inside">
              <li>
                Download{" "}
                <a
                  href="#download-plugin"
                  className="font-bold text-[#00DF89] underline-offset-2 hover:underline"
                >
                  CartRenew for WooCommerce
                </a>{" "}
                (plugin zip — link placeholder).
              </li>
              <li>
                In WordPress admin go to <strong className="text-white">Plugins → Add New → Upload Plugin</strong>.
              </li>
              <li>Upload the zip and activate the plugin.</li>
              <li>
                Open <strong className="text-white">WooCommerce → CartRenew</strong> settings.
              </li>
              <li>Paste the Store ID and API Key from Step 2.</li>
              <li>Save Changes — abandoned carts will start posting to CartRenew.</li>
            </ol>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-xs font-bold text-neutral-300 transition hover:text-white"
              >
                ← Back to credentials
              </button>
              <Link
                href="/en/dashboard"
                className="rounded-xl bg-neutral-100 px-4 py-2.5 text-xs font-black text-neutral-950 transition hover:bg-white"
              >
                Go to dashboard
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
