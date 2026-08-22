"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";

import { Link } from "@/i18n/routing";

const navLinks = [
  { key: "pricing", href: "/pricing" },
  { key: "comparison", href: "/comparison" },
  { key: "woocommerce", href: "/woocommerce", absolute: true as const },
  { key: "dashboard", href: "/dashboard" },
  { key: "docs", href: "/docs" },
] as const;

export default function Navigation() {
  const t = useTranslations("nav");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[rgba(9,9,11,0.85)] backdrop-blur-[20px] border-b border-[rgba(255,255,255,0.06)]"
          : "bg-transparent border-b border-transparent"
      }`}
      style={{ height: 64 }}
    >
      <div className="max-w-[1200px] mx-auto h-full flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-0 text-xl font-bold tracking-tight">
          <span className="text-white">Cart</span>
          <span className="gradient-text">Renew</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) =>
            "absolute" in link && link.absolute ? (
              <a
                key={link.key}
                href={link.href}
                onClick={handleNavClick}
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200"
              >
                {t(link.key)}
              </a>
            ) : (
              <Link
                key={link.key}
                href={link.href}
                onClick={handleNavClick}
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200"
              >
                {t(link.key)}
              </Link>
            )
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/sign-in"
            onClick={handleNavClick}
            className="text-sm text-[var(--text-secondary)] border border-[rgba(255,255,255,0.1)] px-5 py-2.5 rounded-[10px] hover:bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.2)] transition-all duration-200"
          >
            {t("login")}
          </Link>
          <Link
            href="/sign-up"
            onClick={handleNavClick}
            className="gradient-btn text-sm py-2.5 px-5"
          >
            {t("signup")}
          </Link>
        </div>

        <button
          className="md:hidden text-white p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-[var(--bg-elevated)] border-b border-[var(--bg-border)] px-6 py-4">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) =>
              "absolute" in link && link.absolute ? (
                <a
                  key={link.key}
                  href={link.href}
                  onClick={handleNavClick}
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {t(link.key)}
                </a>
              ) : (
                <Link
                  key={link.key}
                  href={link.href}
                  onClick={handleNavClick}
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {t(link.key)}
                </Link>
              )
            )}

            <div className="flex flex-col gap-2 pt-2 border-t border-[var(--bg-border)]">
              <Link
                href="/sign-in"
                onClick={handleNavClick}
                className="text-sm text-center text-[var(--text-secondary)] border border-[rgba(255,255,255,0.1)] px-5 py-2.5 rounded-[10px]"
              >
                {t("login")}
              </Link>
              <Link
                href="/sign-up"
                onClick={handleNavClick}
                className="gradient-btn text-sm py-2.5"
              >
                {t("signup")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
