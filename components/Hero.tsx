"use client";
import { useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import gsap from "gsap";
import { Play, ArrowRight } from "lucide-react";

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.fromTo(".hero-label", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 })
        .fromTo(".hero-headline", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, 0.1)
        .fromTo(".hero-subline", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, 0.2)
        .fromTo(".hero-cta", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4 }, 0.3);
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative min-h-screen flex items-center overflow-hidden" style={{ background: "var(--bg-base)", paddingTop: 120 }}>
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-[52%_48%] gap-12 items-center">
          <div>
            <div className="hero-label inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ background: "rgba(0,214,125,0.1)", border: "1px solid rgba(0,214,125,0.2)" }}>
              <span className="w-2 h-2 rounded-full bg-[#00D67D] animate-pulse" />
              <span className="text-xs font-semibold text-[#00D67D] uppercase tracking-wider">{t("hero.badge")}</span>
            </div>
            <h1 className="hero-headline font-bold text-white leading-[1.08] tracking-[-0.03em]" style={{ fontSize: "clamp(2.5rem, 5vw, 3.8rem)" }}>{t("hero.headline", { percent: "30%" })}</h1>
            <p className="hero-subline text-[var(--text-secondary)] text-lg leading-relaxed mt-5 max-w-[500px]">{t("hero.subheadline")}</p>
            <div className="hero-cta flex flex-wrap gap-4 mt-8">
              <a href="#pricing" className="gradient-btn text-base gap-2">{t("hero.ctaTrial")} <span className="text-xs opacity-80">{t("hero.ctaNoCard")}</span></a>
              <button className="ghost-btn text-base"><Play size={18} /> {t("hero.ctaDemo")}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}