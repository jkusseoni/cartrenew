"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Menu, X } from "lucide-react";
import LanguageSelector from "./LanguageSelector";

export default function Navigation() {
  const { t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#") && href.length > 1) {
      e.preventDefault();
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    }
    setMobileOpen(false);
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[rgba(11,15,26,0.9)] backdrop-blur-[20px] border-b border-[rgba(255,255,255,0.06)]" : "bg-transparent"}`} style={{ height: 64 }}>
      <div className="max-w-[1200px] mx-auto h-full flex items-center justify-between px-6">
        <a href="#" className="text-xl font-bold tracking-tight"><span className="text-white">Cart</span><span className="bg-gradient-to-r from-[#00D67D] to-[#22D3EE] bg-clip-text text-transparent">Renew</span></a>
        <div className="hidden md:flex items-center gap-8">
          {["pricing", "comparison", "dashboard", "docs"].map((k) => (
            <a key={k} href={k === "dashboard" ? "/dashboard" : `#${k}`} onClick={(e) => handleNavClick(e, `#${k}`)} className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">{t(`nav.${k}`)}</a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <LanguageSelector />
          <a href="#pricing" onClick={(e) => handleNavClick(e, "#pricing")} className="gradient-btn text-sm py-2.5 px-5">{t("nav.signup")}</a>
        </div>
        <button className="md:hidden text-white p-2" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={24} /> : <Menu size={24} />}</button>
      </div>
      {mobileOpen && (
        <div className="md:hidden bg-[var(--bg-elevated)] border-b border-[var(--bg-border)] px-6 py-4">
          <div className="flex flex-col gap-4">
            {["pricing", "comparison", "dashboard", "docs"].map((k) => (
              <a key={k} href={`#${k}`} onClick={(e) => handleNavClick(e, `#${k}`)} className="text-sm text-[var(--text-secondary)]">{t(`nav.${k}`)}</a>
            ))}
            <div className="flex flex-col gap-2 pt-2 border-t border-[var(--bg-border)]">
              <LanguageSelector />
              <a href="#pricing" onClick={(e) => handleNavClick(e, "#pricing")} className="gradient-btn text-sm py-2.5 text-center">{t("nav.signup")}</a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}