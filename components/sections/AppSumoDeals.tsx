import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const deals = [
  { label: "Single", price: "$59", stores: "1 Store", badge: null },
  {
    label: "Double",
    price: "$118",
    stores: "3 Stores",
    badge: { text: "POPULAR", color: "#F97316", bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.2)" },
  },
  {
    label: "Multiple",
    price: "$177",
    stores: "Unlimited",
    badge: { text: "BEST DEAL", color: "#8B5CF6", bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.2)" },
  },
];

export default function AppSumoDeals() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".appsumo-card",
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.1,
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
    <section ref={sectionRef} className="pb-[120px]">
      <div className="max-w-[1000px] mx-auto px-6">
        <h2
          className="font-bold text-white tracking-[-0.03em] mb-10"
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
        >
          AppSumo LTD Deals
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {deals.map((deal) => (
            <div
              key={deal.label}
              className="appsumo-card relative rounded-2xl p-6"
              style={{
                background: "var(--bg-card)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {deal.badge && (
                <div
                  className="absolute top-4 right-4 px-2 py-0.5 rounded text-[0.625rem] font-semibold uppercase tracking-wider"
                  style={{
                    background: deal.badge.bg,
                    color: deal.badge.color,
                    border: `1px solid ${deal.badge.border}`,
                    fontFamily: "JetBrains Mono Variable, monospace",
                  }}
                >
                  {deal.badge.text}
                </div>
              )}

              <p className="text-base font-semibold text-[var(--text-secondary)]">{deal.label}</p>
              <p
                className="text-3xl font-bold text-white mt-2"
                style={{ fontFamily: "JetBrains Mono Variable, monospace" }}
              >
                {deal.price}
              </p>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">{deal.stores}</p>

              <button className="w-full mt-5 py-3 rounded-[10px] text-sm font-semibold text-white gradient-btn">
                Buy Now
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
