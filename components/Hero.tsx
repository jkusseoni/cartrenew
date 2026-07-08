"use client";
import { useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import gsap from "gsap";

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
    <section 
      ref={sectionRef} 
      className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-b from-pink-50/40 via-blue-50/30 to-transparent" 
      style={{ paddingTop: 120 }}
    >
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-[55%_45%] gap-12 items-center">
          <div>
            
            {/* प्रीमियम लाइट ग्रीन बैज */}
            <div className="hero-label inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 bg-emerald-50 border border-emerald-200/60 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">{t("hero.badge")}</span>
            </div>
            
            {/* हेडलाइन */}
            <h1 className="hero-headline font-black text-slate-900 leading-[1.08] tracking-[-0.03em]" style={{ fontSize: "clamp(2.5rem, 5vw, 3.8rem)" }}>
              {t("hero.headline", { percent: "30%" })}
            </h1>
            
            {/* सब-हेडलाइन */}
            <p className="hero-subline text-slate-600 text-lg leading-relaxed mt-5 max-w-[520px]">
              {t("hero.subheadline")}
            </p>
            
            {/* सीटीए बटन (सिर्फ ट्रायल बटन रखा गया है) */}
            <div className="hero-cta flex flex-wrap gap-4 mt-8">
              <a 
                href="#pricing" 
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-500 px-6 py-3 text-sm font-black text-white shadow-md shadow-blue-500/10 transition hover:opacity-95 active:scale-[0.98] gap-2"
              >
                {t("hero.ctaTrial")} 
                <span className="text-xs font-medium opacity-90">({t("hero.ctaNoCard")})</span>
              </a>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}