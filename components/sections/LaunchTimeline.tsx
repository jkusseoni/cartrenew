"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  { num: "01", title: "Beta", desc: "Invite-only beta with core feature set and feedback loop." },
  { num: "02", title: "Early Bird", desc: "Open discounts and first customers onboarding." },
  { num: "03", title: "Product Hunt", desc: "Public launch and press outreach." },
  { num: "04", title: "AppSumo", desc: "AppSumo LTD launch with one-time deals." },
];

export default function LaunchTimeline() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Desktop Scroll Animation
      mm.add("(min-width: 768px)", () => {
        gsap.fromTo(
          lineRef.current,
          { scaleX: 0 },
          {
            scaleX: 1,
            transformOrigin: "left center",
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 75%",
              end: "bottom 70%",
              scrub: 1,
            },
          }
        );

        gsap.fromTo(
          nodesRef.current,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.15,
            duration: 0.6,
            ease: "power2.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 70%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Mobile Scroll Animation
      mm.add("(max-width: 767px)", () => {
        nodesRef.current.forEach((node) => {
          gsap.fromTo(
            node,
            { opacity: 0, x: -20 },
            {
              opacity: 1,
              x: 0,
              duration: 0.5,
              scrollTrigger: {
                trigger: node,
                start: "top 85%",
                toggleActions: "play none none reverse",
              },
            }
          );
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="timeline" ref={sectionRef} className="w-full bg-[#0B0F17] py-20 relative border-b border-neutral-900/60 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/[0.01] blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-16">
          Launch Strategy Timeline
        </h2>

        <div className="relative w-full">
          {/* Base Progress Track Lines */}
          <div className="hidden md:block absolute top-[14px] left-0 right-0 h-[2px] bg-neutral-900 -z-10" />
          <div ref={lineRef} className="hidden md:block absolute top-[14px] left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-indigo-500 to-cyan-500 -z-10" />

          {/* Dynamic Grid Mapping */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6 lg:gap-8 relative">
            {steps.map((step, idx) => (
              <div
                key={step.num}
                ref={(el) => { if (el) nodesRef.current[idx] = el; }}
                className="flex flex-col space-y-3 relative group"
              >
                {/* Number Circle Badge */}
                <div className="w-7 h-7 rounded-full bg-neutral-950 border-2 border-indigo-500/80 flex items-center justify-center shadow-lg shadow-indigo-500/20 z-10 self-start md:self-auto group-hover:border-emerald-400 transition-colors duration-300">
                  <span className="font-mono font-bold text-[10px] text-indigo-400 group-hover:text-emerald-400 transition-colors duration-300">
                    {step.num}
                  </span>
                </div>

                {/* Content Layout */}
                <div className="pt-2">
                  <h4 className="text-base font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors duration-300">
                    {step.title}
                  </h4>
                  <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed mt-1">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}