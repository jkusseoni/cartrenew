"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Check, X, Sparkles } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const competitors = [
  { tool: "BiteSpeed", price: "$250/mo", markup: "Yes", ai: true, indiaStack: true, highlight: false },
  { tool: "Zoko", price: "\u20b93,499/mo", markup: "Yes +\u20b91.25/conv", ai: false, indiaStack: true, highlight: false },
  { tool: "Wati", price: "$30/mo", markup: "Yes", ai: false, indiaStack: false, highlight: false },
  { tool: "CartRenew", price: "\u20b9999/mo", markup: "0%", ai: true, indiaStack: true, highlight: true },
];

export default function CompetitorComparison() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".comp-row",
        { opacity: 0, x: -20 },
        {
          opacity: 1,
          x: 0,
          duration: 0.4,
          stagger: 0.08,
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
    <section id="comparison" ref={sectionRef} className="pb-[120px]">
      <div className="max-w-[1000px] mx-auto px-6">
        <h2
          className="font-bold text-white tracking-[-0.03em] mb-8"
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
        >
          Competitor Comparison
        </h2>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Table Header */}
          <div
            className="grid grid-cols-[1.2fr_1fr_1.3fr_0.7fr_1fr] gap-4 px-4 py-3"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            {["TOOL", "PRICE", "WA MARKUP", "AI", "INDIA STACK"].map((h) => (
              <span
                key={h}
                className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]"
                style={{ fontFamily: "JetBrains Mono Variable, monospace" }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Table Rows */}
          {competitors.map((row) => (
            <div
              key={row.tool}
              className={`comp-row grid grid-cols-[1.2fr_1fr_1.3fr_0.7fr_1fr] gap-4 px-4 py-4 items-center ${
                row.highlight ? "border-l-[3px]" : "border-l-[3px] border-l-transparent"
              }`}
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: row.highlight ? "rgba(0,214,125,0.04)" : "transparent",
                borderLeftColor: row.highlight ? "var(--accent-emerald)" : "transparent",
              }}
            >
              <span className={`text-sm font-semibold ${row.highlight ? "text-white" : "text-white"}`}>
                {row.tool}
              </span>
              <span
                className="text-sm text-[var(--text-secondary)]"
                style={{ fontFamily: "JetBrains Mono Variable, monospace" }}
              >
                {row.price}
              </span>
              <span className={`text-sm ${row.highlight ? "gradient-text font-semibold flex items-center gap-1" : "text-[var(--text-secondary)]"}`}>
                {row.markup}
                {row.highlight && <Sparkles size={14} />}
              </span>
              <span>
                {row.ai ? (
                  <Check size={18} className="text-[var(--success)]" />
                ) : (
                  <X size={18} className="text-[var(--error)]" />
                )}
              </span>
              <span>
                {row.indiaStack ? (
                  <Check size={18} className="text-[var(--success)]" />
                ) : (
                  <X size={18} className="text-[var(--error)]" />
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
