"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Check, Sparkles } from "lucide-react";
import { trackMetaCapiEvent } from "@/lib/meta-capi-client";

gsap.registerPlugin(ScrollTrigger);

interface Plan {
  key: LifetimeDealTier;
  name: string;
  priceIndia: string;
  priceGlobal: string;
  badge?: { text: string; color: string; bg: string; border: string };
  orbColor: string;
  ctaText: string;
  ctaBg: string;
  features: string[];
}

type LifetimeDealTier = "SINGLE" | "DOUBLE" | "MULTIPLE";

type CheckoutResponse = {
  error?: string;
  success?: boolean;
  url?: string;
};

const plans: Plan[] = [
  {
    key: "SINGLE",
    name: "Starter",
    priceIndia: "₹999",
    priceGlobal: "$12",
    orbColor: "rgba(0,214,125,0.4)",
    ctaText: "Start Free Trial",
    ctaBg: "var(--accent-gradient)",
    features: [
      "1 Store",
      "200 Cart Recoveries / month",
      "WhatsApp + Email",
      "Basic Dashboard",
      "0% Conversation Markup",
      "14-day Free Trial",
    ],
  },
  {
    key: "DOUBLE",
    name: "Growth",
    priceIndia: "₹2,499",
    priceGlobal: "$29",
    badge: {
      text: "MOST POPULAR",
      color: "#F97316",
      bg: "rgba(249,115,22,0.15)",
      border: "rgba(249,115,22,0.2)",
    },
    orbColor: "rgba(249,115,22,0.4)",
    ctaText: "Get Started",
    ctaBg: "#F97316",
    features: [
      "3 Stores",
      "1,000 Cart Recoveries / month",
      "WhatsApp + Email + SMS",
      "AI Personalized Messages",
      "0% Conversation Markup",
      "COD Verification",
      "Razorpay Payment Links",
      "Analytics Dashboard",
    ],
  },
  {
    key: "MULTIPLE",
    name: "Scale",
    priceIndia: "₹5,999",
    priceGlobal: "$69",
    badge: {
      text: "BEST VALUE",
      color: "#8B5CF6",
      bg: "rgba(139,92,246,0.15)",
      border: "rgba(139,92,246,0.2)",
    },
    orbColor: "rgba(139,92,246,0.4)",
    ctaText: "Go Scale",
    ctaBg: "#8B5CF6",
    features: [
      "Unlimited Stores",
      "Unlimited Recoveries",
      "All Channels",
      "AI Chatbot",
      "Shiprocket Integration",
      "Priority Support",
      "Custom Templates",
      "White Label Option",
    ],
  },
];

export default function Pricing() {
  const [market, setMarket] = useState<"india" | "global">("india");
  const [loadingTier, setLoadingTier] = useState<LifetimeDealTier | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const sectionRef = useRef<HTMLDivElement>(null);

  const handlePlanCheckout = async (plan: Plan) => {
    const price = market === "india" ? plan.priceIndia : plan.priceGlobal;

    setCheckoutError("");
    setLoadingTier(plan.key);

    try {
      await trackMetaCapiEvent({
        eventName: "InitiateCheckout",
        value: parsePlanPrice(price),
        currency: market === "india" ? "INR" : "USD",
        cartId: `plan-${plan.name.toLowerCase()}`,
        contentName: `${plan.name} subscription`,
        items: [
          {
            id: `plan-${plan.name.toLowerCase()}`,
            title: `${plan.name} subscription`,
            price: parsePlanPrice(price),
            quantity: 1,
          },
        ],
      });
    } catch (error) {
      console.warn("Meta CAPI InitiateCheckout tracking failed:", error);
    }

    try {
      const response = await fetch("/api/checkout", {
        body: JSON.stringify({ tier: plan.key }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as CheckoutResponse;

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Unable to start secure checkout");
      }

      window.location.assign(data.url);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to start secure checkout");
      setLoadingTier(null);
    }
  };

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".pricing-card",
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.15,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            once: true,
          },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section id="pricing" ref={sectionRef} className="py-[120px]">
      <div className="max-w-[1100px] mx-auto px-6">
        {/* Header */}
        <div className="text-center">
          <h2
            className="font-bold text-white tracking-[-0.03em]"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Pricing built for growth
          </h2>
          <p className="text-[var(--text-secondary)] mt-3">
            Choose a plan that fits your scale — transparent pricing, no hidden markup.
          </p>
        </div>

        {/* Market Toggle */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <div className="flex gap-2 p-1 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
            <button
              onClick={() => setMarket("india")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                market === "india"
                  ? "text-[var(--india-badge-text)] border"
                  : "text-[var(--text-tertiary)] border border-transparent hover:text-[var(--text-secondary)]"
              }`}
              style={
                market === "india"
                  ? { background: "var(--india-badge-bg)", borderColor: "rgba(74,222,128,0.2)" }
                  : {}
              }
            >
              India
            </button>
            <button
              onClick={() => setMarket("global")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                market === "global"
                  ? "text-[var(--global-badge-text)] border"
                  : "text-[var(--text-tertiary)] border border-transparent hover:text-[var(--text-secondary)]"
              }`}
              style={
                market === "global"
                  ? { background: "var(--global-badge-bg)", borderColor: "rgba(148,163,184,0.2)" }
                  : {}
              }
            >
              Global
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
            <Sparkles size={14} className="text-[var(--accent-emerald)]" />
            Pay annually for 2 months free
          </div>
        </div>

        {checkoutError ? (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {checkoutError}
          </div>
        ) : null}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-10">
          {plans.map((plan) => {
            const isLoading = loadingTier === plan.key;

            return (
              <div
                key={plan.name}
                className="pricing-card relative rounded-[20px] p-8"
                style={{
                  background: "var(--bg-card)",
                  border: plan.badge
                    ? `1px solid ${plan.badge.border}`
                    : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: plan.badge?.color
                    ? `0 0 40px ${plan.badge.color}14`
                    : "none",
                }}
              >
              {/* Badge */}
              {plan.badge && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md text-[0.625rem] font-semibold uppercase tracking-[0.08em] whitespace-nowrap"
                  style={{
                    background: plan.badge.bg,
                    color: plan.badge.color,
                    border: `1px solid ${plan.badge.border}`,
                    fontFamily: "JetBrains Mono Variable, monospace",
                  }}
                >
                  {plan.badge.text}
                </div>
              )}

              {/* Decorative orb */}
              <div
                className="absolute -top-2.5 right-5 w-12 h-12 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${plan.orbColor} 0%, transparent 70%)` }}
              />

              {/* Plan name */}
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>

              {/* Price */}
              <div className="flex items-baseline gap-1 mt-3">
                <span className="text-4xl font-bold text-white" style={{ fontFamily: "JetBrains Mono Variable, monospace" }}>
                  {market === "india" ? plan.priceIndia : plan.priceGlobal}
                </span>
                <span className="text-sm text-[var(--text-tertiary)]">/month</span>
              </div>

              {/* Features */}
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check size={16} className="text-[var(--success)] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-[var(--text-secondary)]">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => void handlePlanCheckout(plan)}
                disabled={loadingTier !== null}
                className="w-full mt-8 py-3.5 rounded-[10px] text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
                style={{
                  background: plan.ctaBg === "var(--accent-gradient)" ? undefined : plan.ctaBg,
                  backgroundImage: plan.ctaBg === "var(--accent-gradient)" ? "linear-gradient(135deg, #00D67D 0%, #22D3EE 100%)" : undefined,
                  cursor: loadingTier ? "not-allowed" : "pointer",
                  opacity: loadingTier && !isLoading ? 0.55 : undefined,
                }}
              >
                {isLoading ? "Opening secure checkout..." : plan.ctaText}
              </button>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function parsePlanPrice(price: string) {
  const parsed = Number(price.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
