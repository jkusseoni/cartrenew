"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { trackMetaCapiEvent } from "@/lib/meta-capi-client";
import {
  validatePhone,
  validatePositiveAmount,
  validateRequired,
  validateUrl,
} from "@/lib/validation";

interface ActivityLog {
  id: number;
  timestamp: string;
  message: string;
  status: "success" | "error" | "info";
}

export default function DashboardPreview() {
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [cartUrl, setCartUrl] = useState("");
  const [cartAmount, setCartAmount] = useState("");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState({ recovered: 0, messages: 0, health: 0 });
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, status: "success" | "error" | "info") => {
    const timestamp = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev, { id: Date.now(), timestamp, message, status }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = [
      validateRequired(customerName, "Customer name"),
      validatePhone(phoneNumber),
      validatePositiveAmount(cartAmount, "Cart amount"),
      validateUrl(cartUrl, { optional: true }),
    ].filter((error): error is string => error !== null);

    if (validationErrors.length > 0) {
      validationErrors.forEach((error) => addLog(`Validation: ${error}`, "error"));
      return;
    }

    addLog(`Triggered recovery for ${customerName} (${phoneNumber})`, "info");
    const cartValue = Number(cartAmount);
    const trackingCartId = cartUrl || `manual-cart-${Date.now()}`;

    try {
      await trackMetaCapiEvent({
        eventName: "AddToCart",
        value: cartValue,
        currency: "INR",
        userPhone: phoneNumber,
        checkoutUrl: cartUrl || undefined,
        cartId: trackingCartId,
        items: [
          {
            id: trackingCartId,
            title: `${customerName} cart recovery`,
            price: cartValue,
            quantity: 1,
          },
        ],
      });
      addLog("Meta CAPI AddToCart event sent", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Meta CAPI event failed";
      addLog(`Meta CAPI error: ${message}`, "error");
    }

    window.setTimeout(() => {
      addLog(`WhatsApp message sent to ${phoneNumber}`, "success");
      setStats((prev) => ({
        recovered: prev.recovered + cartValue,
        messages: prev.messages + 1,
        health: Math.min(100, prev.health + 5),
      }));
    }, 800);

    window.setTimeout(() => {
      addLog(`Follow-up scheduled for ${customerName}`, "success");
    }, 1600);
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <section id="dashboard" className="relative z-10 w-full bg-transparent px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            CartRenew Advanced Dashboard
          </h2>
          <p className="mt-3 text-sm font-medium text-slate-500 sm:text-base">
            Manage recovery workflows, monitor logs, and trigger sequences.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Recovered Pipeline
            </p>
            <p className="font-mono text-3xl font-bold text-emerald-600">
              ₹{stats.recovered.toLocaleString("en-IN")}.00
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Messages Sent
            </p>
            <p className="font-mono text-3xl font-bold text-slate-900">{stats.messages}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pipeline Health Rate
            </p>
            <p className="font-mono text-3xl font-bold text-blue-600">{stats.health}%</p>
          </div>
        </div>

        <div className="grid min-h-[420px] grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Manual Cart Recovery Trigger</h3>
            <p className="mt-1 text-sm text-slate-500">
              Test your localized Hinglish recovery engine sequence instantly.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Customer Name
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., Rahul Kumar"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Phone Number
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., 919755612850"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Abandon Cart URL
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  placeholder="https://cartrenew.vercel.app/cart/123"
                  value={cartUrl}
                  onChange={(e) => setCartUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Cart Total Amount (INR)
                </label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g., 1499"
                  value={cartAmount}
                  onChange={(e) => setCartAmount(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-[10px] bg-blue-600 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Send size={16} />
                Send WhatsApp Recovery Sequence
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Live Activity Stream</h3>
            <p className="mt-1 text-sm text-slate-500">Latest execution logs in this session.</p>

            <div
              ref={logContainerRef}
              className="mt-4 max-h-[420px] min-h-[260px] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-4"
            >
              {logs.length === 0 ? (
                <p className="mt-20 text-center text-sm text-slate-400">
                  No sequences triggered yet. Use the form to fire a test payload.
                </p>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 font-mono text-xs text-slate-400">
                        {log.timestamp}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            log.status === "success"
                              ? "bg-emerald-500"
                              : log.status === "error"
                                ? "bg-red-500"
                                : "bg-amber-400"
                          }`}
                        />
                        <span className="text-sm text-slate-600">{log.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
