"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const projections = [
  { label: "50 Users", mrr: "\u20b91,500 MRR", width: 15 },
  { label: "200 Users", mrr: "\u20b97,000 MRR", width: 45 },
  { label: "500 Users", mrr: "\u20b920,000 MRR", width: 85 },
];

export default function RevenueProjections() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".rev-card",
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
            onEnter: () => {
              barsRef.current.forEach((bar, i) => {
                if (bar) {
                  gsap.fromTo(
                    bar,
                    { width: "0%" },
                    { width: `${projections[i].width}%`, duration: 1, ease: "power2.out", delay: i * 0.15 }
                  );
                }
              });
            },
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
          className="font-bold text-white tracking-[-0.03em] mb-8"
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
        >
          Revenue Projections
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {projections.map((proj, i) => (
            <div
              key={proj.label}
              className="rev-card rounded-2xl p-6"
              style={{
                background: "var(--bg-card)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[var(--text-tertiary)]">{proj.label}</p>
                  <p
                    className="text-2xl font-bold text-white mt-1"
                    style={{ fontFamily: "JetBrains Mono Variable, monospace" }}
                  >
                    {proj.mrr}
                  </p>
                </div>
                <span className="text-xs text-[var(--text-tertiary)]">Growth</span>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  ref={(el) => { if (el) barsRef.current[i] = el; }}
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #10B981 0%, #F59E0B 50%, #EF4444 100%)",
                    width: "0%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
