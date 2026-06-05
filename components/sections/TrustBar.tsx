import { Shield, Lock, Sparkles } from "lucide-react";

const items = [
  {
    icon: null,
    title: "TRUSTED BY 100+ SHOPIFY BRANDS",
    subtitle: "",
    isLabel: true,
  },
  {
    icon: Shield,
    title: "0% Markup Guaranteed",
    subtitle: "Transparent recovery pricing",
  },
  {
    icon: Lock,
    title: "Secure Setup",
    subtitle: "Shopify + WhatsApp-safe onboarding",
  },
  {
    icon: Sparkles,
    title: "14-day Free Trial",
    subtitle: "No commitment. Instant activation",
  },
];

export default function TrustBar() {
  return (
    <section
      className="py-6"
      style={{ background: "var(--bg-elevated)" }}
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-2">
              {item.isLabel ? (
                <p
                  className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]"
                  style={{ fontFamily: "JetBrains Mono Variable, monospace" }}
                >
                  {item.title}
                </p>
              ) : (
                <>
                  {item.icon && (
                    <div className="w-5 h-5 gradient-text">
                      <item.icon size={20} />
                    </div>
                  )}
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{item.subtitle}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
