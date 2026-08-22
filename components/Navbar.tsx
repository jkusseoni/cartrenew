"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type NavLink =
  | { key: "pricing" | "comparison" | "dashboard" | "docs"; href: string; absolute?: false }
  | { key: "woocommerce"; href: "/woocommerce"; absolute: true };

const navLinks: NavLink[] = [
  { key: "pricing", href: "/pricing" },
  { key: "comparison", href: "/comparison" },
  { key: "woocommerce", href: "/woocommerce", absolute: true },
  { key: "dashboard", href: "/dashboard" },
  { key: "docs", href: "/docs" },
];

const linkClassDesktop =
  "text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors uppercase tracking-wider";
const linkClassMobile =
  "text-sm font-bold text-slate-700 hover:text-blue-600 transition-all";

export default function Navbar() {
  const t = useTranslations("nav");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm"
          : "bg-transparent"
      }`}
      style={{ height: 64 }}
    >
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6">
        <Link href="/" className="text-xl font-black tracking-tight flex items-center gap-1">
          <span className="text-slate-900">Cart</span>
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Renew
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) =>
            link.absolute ? (
              <a key={link.key} href={link.href} className={linkClassDesktop}>
                {t(link.key)}
              </a>
            ) : (
              <Link key={link.key} href={link.href} className={linkClassDesktop}>
                {t(link.key)}
              </Link>
            )
          )}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <LanguageSwitcher />
          <Link
            href="/sign-in"
            className="text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            {t("login")}
          </Link>
          <Link
            href="/sign-up"
            className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/10"
          >
            {t("signup")}
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden text-slate-800 p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-6 py-6 shadow-xl absolute w-full left-0 top-16 flex flex-col gap-5">
          {navLinks.map((link) =>
            link.absolute ? (
              <a
                key={link.key}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={linkClassMobile}
              >
                {t(link.key)}
              </a>
            ) : (
              <Link
                key={link.key}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={linkClassMobile}
              >
                {t(link.key)}
              </Link>
            )
          )}
          <div className="pt-2">
            <LanguageSwitcher />
          </div>
          <div className="flex flex-col gap-4 pt-4 border-t border-slate-100">
            <Link
              href="/sign-in"
              className="text-sm font-bold text-slate-700 text-center transition-all"
              onClick={() => setMobileOpen(false)}
            >
              {t("login")}
            </Link>
            <Link
              href="/sign-up"
              className="bg-blue-600 text-white text-xs font-black py-3 rounded-xl text-center shadow-md"
              onClick={() => setMobileOpen(false)}
            >
              {t("signup")}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
