"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Globe, ChevronDown, Check } from "lucide-react";

export default function LanguageSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { locale, setLocale, locales, localeNames, localeFlags } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-white transition-all" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Globe size={15} /><span className="hidden sm:inline">{localeFlags[locale]} {localeNames[locale]}</span><span className="sm:hidden">{localeFlags[locale]}</span><ChevronDown size={13} className={isOpen ? "rotate-180" : ""} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 rounded-xl overflow-hidden z-50" style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div className="max-h-72 overflow-y-auto py-1">
              {locales.map((code) => (
                <button key={code} onClick={() => { setLocale(code); setIsOpen(false); }} className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left ${locale === code ? "text-white bg-[rgba(0,214,125,0.08)]" : "text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"}`}>
                  <span className="flex items-center gap-3"><span className="text-base">{localeFlags[code]}</span><span>{localeNames[code]}</span></span>
                  {locale === code && <Check size={14} className="text-[var(--accent-emerald)]" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}