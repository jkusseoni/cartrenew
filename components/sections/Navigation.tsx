import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Pricing", href: "#pricing" },
  { label: "Comparison", href: "#comparison" },
  { label: "Dashboard", href: "#dashboard" },
  { label: "Docs", href: "#" },
];

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#") && href.length > 1) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    }
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
        {/* Logo */}
        <a href="#" className="flex items-center gap-0 text-xl font-bold tracking-tight">
          <span className="text-white">Cart</span>
          <span className="gradient-text">Renew</span>
        </a>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="#dashboard"
            onClick={(e) => handleNavClick(e, "#dashboard")}
            className="text-sm text-[var(--text-secondary)] border border-[rgba(255,255,255,0.1)] px-5 py-2.5 rounded-[10px] hover:bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.2)] transition-all duration-200"
          >
            View Dashboard
          </a>
          <a
            href="#pricing"
            onClick={(e) => handleNavClick(e, "#pricing")}
            className="gradient-btn text-sm py-2.5 px-5"
          >
            Start Free Trial
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[var(--bg-elevated)] border-b border-[var(--bg-border)] px-6 py-4">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2 border-t border-[var(--bg-border)]">
              <a
                href="#dashboard"
                onClick={(e) => handleNavClick(e, "#dashboard")}
                className="text-sm text-center text-[var(--text-secondary)] border border-[rgba(255,255,255,0.1)] px-5 py-2.5 rounded-[10px]"
              >
                View Dashboard
              </a>
              <a
                href="#pricing"
                onClick={(e) => handleNavClick(e, "#pricing")}
                className="gradient-btn text-sm py-2.5"
              >
                Start Free Trial
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
