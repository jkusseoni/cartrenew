"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  { num: "01", title: "Beta", desc: "Invite-only beta with core feature set and feedback loop" },
  { num: "02", title: "Early Bird", desc: "Open discounts and first customers onboarding" },
  { num: "03", title: "Product Hunt", desc: "Public launch and press outreach" },
  { num: "04", title: "AppSumo", desc: "AppSumo LTD launch with one-time deals" },
];

export default function LaunchTimeline() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          once: true,
        },
      });

      tl.fromTo(
        lineRef.current,
        { scaleX: 0 },
        { scaleX: 1, duration: 0.8, ease: "power2.out" }
      ).fromTo(
        ".timeline-step",
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.5, stagger: 0.12, ease: "power2.out" },
        0.3
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="pb-[120px] overflow-hidden">
      <div className="max-w-[1000px] mx-auto px-6 overflow-hidden">
        <h2
          className="font-bold text-white tracking-[-0.03em] mb-8"
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
        >
          Launch Strategy Timeline
        </h2>

        <div className="relative overflow-hidden">
          {/* Timeline Connector Line - Desktop */}
          <div
            ref={lineRef}
            className="hidden md:block absolute top-5 left-0 right-0 h-0.5 origin-left"
            style={{
              background: "linear-gradient(90deg, #00D67D, #22D3EE)",
              boxShadow: "0 0 10px rgba(0,214,125,0.3)",
            }}
          />

          {/* Steps */}
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="timeline-step relative">
                {/* Number marker */}
                <div
                  className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center mb-4"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <span
                    className="text-sm font-bold text-white"
                    style={{ fontFamily: "JetBrains Mono Variable, monospace" }}
                  >
                    {step.num}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white">{step.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
