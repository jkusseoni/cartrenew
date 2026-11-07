"use client";

import { useEffect, useState, type FormEvent } from "react";

import { maskPhone } from "@/lib/phone";
import { authFetch } from "@/lib/shopify/authFetch";
import {
  TEST_MESSAGE_OPTED_OUT_CODE,
  TEST_MESSAGE_OPTED_OUT_TEXT,
  testDeliveryView,
  type TestDeliveryView,
} from "@/lib/shopify/test-message-config";

type Props = {
  shop: string;
  dailyLimit: number;
};

/** Longer than the route's 20s wait on Meta, so its 202 reply arrives. */
const TEST_MESSAGE_REQUEST_TIMEOUT_MS = 30_000;

/** First check after 3s, then every 4s, for about a minute. */
const DELIVERY_FIRST_CHECK_MS = 3_000;
const DELIVERY_POLL_MS = 4_000;
const DELIVERY_MAX_CHECKS = 15;

const GENERIC_ERROR = "The test message couldn't be sent. Try again.";

export type TestMessageResult =
  | { kind: "sent"; phone: string; remaining: number; pendingMessage: string | null; id: string | null }
  /** `warning` (amber) for the daily limit and an opted-out number; otherwise red. */
  | { kind: "error"; message: string; warning: boolean };

export type TestMessageResponse = {
  ok?: boolean;
  pending?: boolean;
  message?: string;
  remaining?: number;
  error?: string;
  code?: string;
  id?: string;
};

/** What the card shows for a response from POST /api/shopify/test-message. */
export function testMessageResult(
  status: number,
  data: TestMessageResponse,
  phone: string
): TestMessageResult {
  if (data.code === TEST_MESSAGE_OPTED_OUT_CODE) {
    return { kind: "error", message: TEST_MESSAGE_OPTED_OUT_TEXT, warning: true };
  }
  if (status < 200 || status >= 300 || !data.ok) {
    return { kind: "error", message: data.error || GENERIC_ERROR, warning: status === 429 };
  }
  return {
    kind: "sent",
    phone,
    remaining: data.remaining ?? 0,
    pendingMessage: status === 202 || data.pending ? data.message || null : null,
    id: typeof data.id === "string" && data.id ? data.id : null,
  };
}

function remainingText(remaining: number): string {
  if (remaining <= 0) return "No test messages left today.";
  return `${remaining} test message${remaining === 1 ? "" : "s"} left today.`;
}

export function DeliveryLine({ delivery }: { delivery: TestDeliveryView | null }) {
  if (!delivery) return null;
  if (delivery.state === "checking") {
    return <p className="mt-2 text-emerald-200/80">Checking delivery…</p>;
  }
  const tone =
    delivery.state === "failed"
      ? "text-rose-300"
      : delivery.state === "delivered"
        ? "font-black text-emerald-300"
        : "text-amber-300";
  return <p className={`mt-2 ${tone}`}>{delivery.text}</p>;
}

export function TestMessageResultView({
  result,
  delivery = null,
}: {
  result: TestMessageResult | null;
  delivery?: TestDeliveryView | null;
}) {
  return (
    <div aria-live="polite">
      {result?.kind === "sent" ? (
        <div className="mt-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-300">
          <p className="font-black">
            {result.pendingMessage ??
              `WhatsApp accepted the test message for ${maskPhone(result.phone)}.`}
          </p>
          <p className="mt-1 text-emerald-200/80">
            {result.pendingMessage ? "" : "It can take a minute to arrive. "}
            {remainingText(result.remaining)}
          </p>
          <DeliveryLine delivery={delivery} />
        </div>
      ) : null}

      {result?.kind === "error" ? (
        <div
          role="alert"
          className={`mt-4 rounded-xl px-4 py-3 text-xs ${
            result.warning
              ? "border border-amber-900/40 bg-amber-950/20 text-amber-300"
              : "border border-rose-900/40 bg-rose-950/30 text-rose-300"
          }`}
        >
          {result.message}
        </div>
      ) : null}
    </div>
  );
}

export default function ShopifyTestMessageCard({ shop, dailyLimit }: Props) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestMessageResult | null>(null);
  const [deliveryState, setDeliveryState] = useState<{ id: string; view: TestDeliveryView } | null>(
    null
  );

  const sentId = result?.kind === "sent" ? result.id : null;
  // Until the first report for this send arrives, show "checking".
  const delivery: TestDeliveryView | null = !sentId
    ? null
    : deliveryState?.id === sentId
      ? deliveryState.view
      : { state: "checking" };

  useEffect(() => {
    if (!sentId) return;
    let cancelled = false;
    let timer: number | undefined;
    let checks = 0;
    const setDelivery = (view: TestDeliveryView) => setDeliveryState({ id: sentId, view });

    const check = async () => {
      checks += 1;
      const last = checks >= DELIVERY_MAX_CHECKS;
      try {
        const res = await authFetch(
          `/api/shopify/test-message/status?id=${encodeURIComponent(sentId)}`,
          { timeoutMs: 8_000 }
        );
        const data = (await res.json().catch(() => ({}))) as {
          delivery_status?: string | null;
          delivery_error?: string | null;
        };
        if (cancelled) return;
        const view = testDeliveryView(data.delivery_status, data.delivery_error, last);
        setDelivery(view);
        if (view.state === "delivered" || view.state === "failed" || last) return;
      } catch {
        if (cancelled) return;
        if (last) {
          setDelivery(testDeliveryView(null, null, true));
          return;
        }
      }
      timer = window.setTimeout(check, DELIVERY_POLL_MS);
    };

    timer = window.setTimeout(check, DELIVERY_FIRST_CHECK_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [sentId]);

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
      const data = (await res.json().catch(() => ({}))) as TestMessageResponse;
      setResult(testMessageResult(res.status, data, target));
    } catch (err) {
      setResult({
        kind: "error",
        message: err instanceof Error ? err.message : GENERIC_ERROR,
        warning: false,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-neutral-800 bg-neutral-950/40 p-6">
      <h2 className="text-lg font-black text-white">Send test message</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Send one short test WhatsApp message to your own phone to check that messages reach you. It
        doesn&apos;t create a cart or count toward your plan. Up to {dailyLimit} per day.
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

      <TestMessageResultView result={result} delivery={delivery} />
    </section>
  );
}
