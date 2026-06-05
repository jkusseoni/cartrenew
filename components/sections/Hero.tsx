"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

function GradientMesh() {
  const meshRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!meshRef.current) return;
    const orbs = meshRef.current.querySelectorAll(".gradient-orb");
    orbs.forEach((orb, i) => {
      gsap.to(orb, {
        x: `${Math.sin(i * 1.5) * 80}`,
        y: `${Math.cos(i * 1.2) * 60}`,
        duration: 18 + i * 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });
  }, []);

  return (
    <div ref={meshRef} className="gradient-mesh">
      <div
        className="gradient-orb"
        style={{
          width: 500,
          height: 500,
          background: "radial-gradient(circle, rgba(0,214,125,0.08) 0%, transparent 70%)",
          top: "10%",
          left: "20%",
        }}
      />
      <div
        className="gradient-orb"
        style={{
          width: 400,
          height: 400,
          background: "radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)",
          top: "30%",
          right: "10%",
        }}
      />
      <div
        className="gradient-orb"
        style={{
          width: 350,
          height: 350,
          background: "radial-gradient(circle, rgba(0,214,125,0.05) 0%, transparent 70%)",
          bottom: "20%",
          left: "40%",
        }}
      />
      <div
        className="gradient-orb"
        style={{
          width: 450,
          height: 450,
          background: "radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 70%)",
          bottom: "10%",
          right: "30%",
        }}
      />
    </div>
  );
}

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.fromTo(".hero-label", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 })
        .fromTo(".hero-headline", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, 0.1)
        .fromTo(".hero-subline", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, 0.2)
        .fromTo(".hero-cta", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4 }, 0.3)
        .fromTo(".hero-stat", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 }, 0.4)
        .fromTo(".hero-card", { opacity: 0, x: 40, scale: 0.95 }, { opacity: 1, x: 0, scale: 1, duration: 0.7 }, 0.2);
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: "var(--bg-base)", paddingTop: 140 }}
    >
      <GradientMesh />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-[55%_45%] gap-12 items-center">
          {/* Left Column — Text */}
          <div>
            <p className="hero-label label-mono mb-5" style={{ letterSpacing: "0.12em" }}>
              WHATSAPP CART RECOVERY FOR MODERN D2C BRANDS
            </p>

            <h1
              className="hero-headline font-bold text-white leading-[1.1] tracking-[-0.03em] text-wrap-balance"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
            >
              Recover abandoned carts with{" "}
              <span className="gradient-text">WhatsApp automation</span> built for Shopify stores.
            </h1>

            <p className="hero-subline text-[var(--text-secondary)] text-lg leading-relaxed mt-5 max-w-[520px]">
              CartRenew helps you recover revenue with intelligent WhatsApp follow-ups, AI
              personalized messages, and a dashboard built for growth.
            </p>

            <div className="hero-cta flex flex-wrap gap-4 mt-8">
              <a href="#pricing" className="gradient-btn text-base">
                Start Your Free Trial
              </a>
              <a href="#" className="ghost-btn text-base">
                View Integrations
              </a>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap gap-8 mt-12">
              <div className="hero-stat flex items-center gap-6">
                <div>
                  <p className="label-mono mb-1">RECOVERY RATE</p>
                  <p className="text-3xl font-bold text-white">68%</p>
                </div>
                <div
                  className="hidden sm:block w-px h-10"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                />
              </div>
              <div className="hero-stat flex items-center gap-6">
                <div>
                  <p className="label-mono mb-1">CHANNELS</p>
                  <p className="text-lg font-semibold text-white">WhatsApp, Email, SMS</p>
                </div>
                <div
                  className="hidden sm:block w-px h-10"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                />
              </div>
              <div className="hero-stat">
                <p className="label-mono mb-1">LAUNCH</p>
                <p className="text-lg font-semibold text-white">Built for Shopify</p>
              </div>
            </div>
          </div>

          {/* Right Column — Dashboard Card */}
          <div className="hero-card relative">
            <div
              className="relative rounded-[20px] p-8 overflow-hidden"
              style={{
                background: "var(--bg-card)",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 60px rgba(0,214,125,0.08)",
              }}
            >
              {/* Decorative orb */}
              <div
                className="absolute -top-5 -right-5 w-20 h-20 rounded-full pointer-events-none"
                style={{
                  background: "radial-gradient(circle, rgba(0,214,125,0.3) 0%, transparent 70%)",
                }}
              />

              {/* Card Header */}
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-[0.12em] mb-3"
                  style={{ color: "var(--accent-emerald)", fontFamily: "JetBrains Mono Variable, monospace" }}
                >
                  CARTRENEW
                </p>
                <h3 className="text-xl font-bold text-white leading-tight">
                  WhatsApp cart recovery without hidden fees.
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
                  Recover more revenue with automated reminders, ROI-first analytics, and flexible
                  pricing for every stage.
                </p>
              </div>

              {/* Feature List */}
              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: "#10B981" }}
                  />
                  <p className="text-sm text-[var(--text-secondary)]">
                    Fast setup for Shopify and WhatsApp Business API
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: "#F59E0B" }}
                  />
                  <p className="text-sm text-[var(--text-secondary)]">
                    Ready-to-use templates with AI personalization
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: "#3B82F6" }}
                  />
                  <p className="text-sm text-[var(--text-secondary)]">
                    Optimize recovery flows with real-time analytics
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
