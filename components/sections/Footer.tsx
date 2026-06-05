import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const linkColumns = [
  {
    title: "Product",
    links: ["Pricing", "Dashboard", "Integrations", "API Docs"],
  },
  {
    title: "Company",
    links: ["About", "Blog", "Careers", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy Policy", "Terms of Service", "GDPR"],
  },
  {
    title: "Connect",
    links: ["Twitter/X", "LinkedIn", "GitHub", "Discord"],
  },
];

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!footerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".footer-content",
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
          scrollTrigger: {
            trigger: footerRef.current,
            start: "top 90%",
            once: true,
          },
        }
      );
    }, footerRef);
    return () => ctx.revert();
  }, []);

  return (
    <footer ref={footerRef} className="relative">
      {/* Curved SVG Divider */}
      <div className="w-full overflow-hidden leading-none">
        <svg
          viewBox="0 0 1440 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto block"
          preserveAspectRatio="none"
        >
          <path
            d="M0 60V30C240 50 480 60 720 60C960 60 1200 50 1440 30V60H0Z"
            fill="#0F1117"
          />
        </svg>
      </div>

      {/* Footer Content */}
      <div className="footer-content" style={{ background: "var(--bg-elevated)" }}>
        <div className="max-w-[1200px] mx-auto px-6 pt-16 pb-10">
          {/* Top Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <a href="#" className="flex items-center text-xl font-bold tracking-tight">
              <span className="text-white">Cart</span>
              <span className="gradient-text">Renew</span>
            </a>
            <p className="text-sm text-[var(--text-tertiary)]">
              &copy; 2025 CartRenew. All rights reserved.
            </p>
          </div>

          {/* Link Columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12">
            {linkColumns.map((col) => (
              <div key={col.title}>
                <p className="text-sm font-semibold text-white mb-4">{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors duration-200"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom Bar */}
          <div
            className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-xs text-[var(--text-muted)]">
              Made with &hearts; for Shopify brands worldwide
            </p>
            <p className="text-xs text-[var(--text-muted)]">CartRenew</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
