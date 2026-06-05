"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";

export default function ChatCheckout() {
  const [step, setStep] = useState(1);

  return (
    <div className="bg-neutral-950/40 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
          <ShoppingBag className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">2. In-Chat Conversational Checkout</h3>
          <p className="text-xs text-neutral-500">Zero-Friction WhatsApp Native Checkout</p>
        </div>
      </div>

      <p className="text-sm text-neutral-400 leading-relaxed mb-6">
        Customer ko link par click karke dubara browser loading ka jhanjhat nahi jhelna padega. WhatsApp Business API sandbox ke andar payment gateways integration logic seedhe complete card clearance runtime ko invoke karta hai.
      </p>

      {/* Interactive Chat Sandbox UI */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden max-w-sm mx-auto">
        <div className="bg-emerald-950/60 border-b border-neutral-800 p-3 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-bold text-neutral-200">CartRenew WhatsApp Node</span>
        </div>
        
        <div className="p-4 space-y-3">
          <div className="bg-neutral-800 text-xs text-neutral-300 p-2.5 rounded-lg rounded-tl-none max-w-[85%]">
            📦 Your Shopify Cart has 1 Product waiting. Would you like to check out natively?
          </div>

          {step >= 2 && (
            <div className="bg-indigo-600 text-xs text-white p-2.5 rounded-lg rounded-tr-none max-w-[50%] ml-auto text-right">
              Yes, checkout now
            </div>
          )}

          {step >= 2 && (
            <div className="bg-neutral-800 text-xs text-neutral-300 p-2.5 rounded-lg rounded-tl-none max-w-[85%] border border-emerald-500/20">
              💳 Click below to authenticate payment safely via Stripe:
              <div className="mt-2 bg-neutral-950 p-2 rounded border border-neutral-700 flex justify-between items-center text-[10px]">
                <span>Total: $59.00 USD</span>
                <span className="text-emerald-400 font-bold">Pay Native</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-2.5 bg-neutral-950 border-t border-neutral-800 flex justify-end">
          {step === 1 ? (
            <button 
              onClick={() => setStep(2)}
              className="bg-emerald-600 text-white font-semibold text-[11px] px-3 py-1.5 rounded"
            >
              Simulate Reply
            </button>
          ) : (
            <button 
              onClick={() => setStep(1)}
              className="text-neutral-500 font-semibold text-[11px] px-3 py-1.5 rounded hover:text-neutral-400"
            >
              Reset Simulation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
