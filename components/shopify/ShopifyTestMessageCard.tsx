"use client";

import { useState, type FormEvent } from "react";

import { maskPhone } from "@/lib/phone";
import { authFetch } from "@/lib/shopify/authFetch";

type Props = {
  shop: string;
  dailyLimit: number;
};

/** Longer than the route's 20s wait on Meta, so its 202 reply arrives. */
const TEST_MESSAGE_REQUEST_TIMEOUT_MS = 30_000;

type Result =
  | { kind: "sent"; phone: string; remaining: number; pendingMessage: string | null }
  | { kind: "error"; message: string; limitReached: boolean };

function remainingText(remaining: number): string {
  if (remaining <= 0) return "No test messages left today.";
  return `${remaining} test message${remaining === 1 ? "" : "s"} left today.`;
}

export default function ShopifyTestMessageCard({ shop, dailyLimit }: Props) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const sendTest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = phone.trim();
    if (!target || sending) return;

    setSending(true);
    setResult(null);

    try {
      const res = await authFetch("/api/shopify/test-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: target, shop }),
        timeoutMs: TEST_MESSAGE_REQUEST_TIMEOUT_MS,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        pending?: boolean;
        message?: string;
        remaining?: number;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setResult({
          kind: "error",
          message: data.error || "The test message couldn't be sent. Try again.",
          limitReached: res.status === 429,
        });
        return;
      }

      setResult({
        kind: "sent",
        phone: target,
        remaining: data.remaining ?? 0,
        pendingMessage: res.status === 202 || data.pending ? data.message || null : null,
      });
    } catch (err) {
      setResult({
        kind: "error",
        message: err instanceof Error ? err.message : "The test message couldn't be sent. Try again.",
        limitReached: false,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-6">
      <h2 className="text-lg font-black text-white">Send test message</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Send one sample cart-recovery WhatsApp message to your own phone. It is marked TEST, links
        to your store&apos;s cart page, and doesn&apos;t create a cart or count toward your plan.
        Up to {dailyLimit} per day.
      </p>

      <form onSubmit={sendTest} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            WhatsApp number
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+447700900123"
            aria-describedby="test-message-help"
            className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 font-mono text-sm text-white placeholder:text-neutral-600 focus:border-[#00DF89] focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={sending || !phone.trim()}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send test message"}
        </button>
      </form>
      <p id="test-message-help" className="mt-2 text-[11px] text-neutral-500">
        International format: + then country code and number.
      </p>

      <div aria-live="polite">
        {result?.kind === "sent" ? (
          <div className="mt-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-300">
            <p className="font-black">
              {result.pendingMessage ?? `Test message sent to ${maskPhone(result.phone)}.`}
            </p>
            <p className="mt-1 text-emerald-200/80">
              {result.pendingMessage ? "" : "It can take a minute to arrive. "}
              {remainingText(result.remaining)}
            </p>
          </div>
        ) : null}

        {result?.kind === "error" ? (
          <div
            role="alert"
            className={`mt-4 rounded-xl px-4 py-3 text-xs ${
              result.limitReached
                ? "border border-amber-900/40 bg-amber-950/20 text-amber-300"
                : "border border-rose-900/40 bg-rose-950/30 text-rose-300"
            }`}
          >
            {result.message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
