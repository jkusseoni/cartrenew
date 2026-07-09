"use client";

import { useEffect, useRef, useState } from "react";
import { ShoppingBag } from "lucide-react";

export default function ChatCheckout() {
  const [step, setStep] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSimulateReply = () => {
    setStep(2);
    setIsCompleted(false);
    setIsTyping(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setIsCompleted(true);
      timeoutRef.current = null;
    }, 2000);
  };

  const handleReset = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStep(1);
    setIsTyping(false);
    setIsCompleted(false);
  };

  return (
    <div className="min-h-[280px] rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50">
          <ShoppingBag className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">2. In-Chat Conversational Checkout</h3>
          <p className="text-xs text-slate-500">Zero-Friction WhatsApp Native Checkout</p>
        </div>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-slate-600">
        Customers can complete payment inside WhatsApp without bouncing back to a browser checkout
        page. Payment gateway auth runs natively in the conversation flow.
      </p>

      <div className="mx-auto max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-emerald-50 p-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold text-slate-700">CartRenew WhatsApp Node</span>
        </div>

        <div className="space-y-3 p-4">
          <div className="max-w-[85%] rounded-lg rounded-tl-none bg-slate-100 p-2.5 text-xs text-slate-700">
            📦 Your Shopify Cart has 1 Product waiting. Would you like to check out natively?
          </div>

          {step >= 2 && (
            <div className="ml-auto max-w-[50%] rounded-lg rounded-tr-none bg-indigo-600 p-2.5 text-right text-xs text-white">
              Yes, checkout now
            </div>
          )}

          {step >= 2 && (
            <div className="max-w-[85%] rounded-lg rounded-tl-none border border-emerald-200 bg-slate-100 p-2.5 text-xs text-slate-700">
              💳 Click below to authenticate payment safely via Stripe:
              <div className="mt-2 flex items-center justify-between rounded border border-slate-200 bg-white p-2 text-[10px]">
                <span>Total: $59.00 USD</span>
                <span className="font-bold text-emerald-600">Pay Native</span>
              </div>
            </div>
          )}

          {isTyping && (
            <div className="flex w-fit items-center gap-1.5 rounded-lg rounded-tl-none bg-slate-100 p-2.5">
              <span className="sr-only">Bot is typing</span>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            </div>
          )}

          {isCompleted && (
            <div className="max-w-[90%] rounded-lg rounded-tl-none border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
              ✅ Order completed via native WhatsApp gateway! Secure payload logged.
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 p-2.5">
          {step === 1 ? (
            <button
              type="button"
              onClick={handleSimulateReply}
              className="rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              Simulate Reply
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              disabled={isTyping}
              className="rounded px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset Simulation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
