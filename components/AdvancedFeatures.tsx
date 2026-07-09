"use client";

import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  Globe2,
  Layers3,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import ChatCheckout from "@/components/features/ChatCheckout";
import RagChatbot from "@/components/features/RagChatbot";
import SegmentationTest from "@/components/features/SegmentationTest";
import VideoMessaging from "@/components/features/VideoMessaging";

type BlueprintRow = {
  area: string;
  capability: string;
  icon: LucideIcon;
  impact: string;
  priority: string;
};

const blueprintRows: BlueprintRow[] = [
  {
    area: "Localization",
    capability: "90+ language recovery flows",
    icon: Globe2,
    impact:
      "Translate reminders, offers, and policy answers by market without rebuilding campaigns.",
    priority: "Market fit",
  },
  {
    area: "Payments",
    capability: "Multi-currency checkout rails",
    icon: CreditCard,
    impact: "Route recovered carts through USD, INR, EUR, GBP, and AED-ready payment paths.",
    priority: "Revenue capture",
  },
  {
    area: "Omnichannel",
    capability: "Fallback recovery routing",
    icon: Layers3,
    impact: "Escalate from WhatsApp to SMS, email, or web push when channel delivery weakens.",
    priority: "Deliverability",
  },
  {
    area: "Agency Ops",
    capability: "White-label workspace matrix",
    icon: ShieldCheck,
    impact: "Separate brands, clients, permissions, and reporting views for reseller operations.",
    priority: "Partner scale",
  },
  {
    area: "Intelligence",
    capability: "Predictive drop-off signals",
    icon: TrendingUp,
    impact: "Score carts by risk, margin, and urgency so high-value recoveries get priority.",
    priority: "Automation depth",
  },
];

export default function AdvancedFeatures() {
  return (
    <section
      id="features"
      className="relative z-10 w-full overflow-hidden border-t border-slate-200/60 bg-transparent px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-[-10%] top-[20%] h-[600px] w-[600px] rounded-full bg-blue-100/40 blur-[130px] mix-blend-multiply" />
        <div className="absolute bottom-[10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-pink-100/40 blur-[140px] mix-blend-multiply" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-12 max-w-3xl space-y-4 text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-sm">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            Advanced Automation Layer
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Future-ready recovery features for{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-600 bg-clip-text text-transparent">
              global SaaS scale
            </span>
          </h2>
          <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
            Expand the core cart recovery stack with rich media, checkout-native conversations,
            context-aware AI support, and segmentation testing for cross-border merchants.
          </p>
        </div>

        {/* Interactive feature widgets — always visible (no GSAP opacity:0) */}
        <div className="grid min-h-[320px] grid-cols-1 gap-6 xl:grid-cols-2">
          <VideoMessaging />
          <ChatCheckout />
          <RagChatbot />
          <SegmentationTest />
        </div>

        <div className="mt-14 overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur-xl">
          <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-5 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
              Blueprint matrix
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              Global SaaS Scaling Blueprint
            </h3>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4 sm:px-6">Scale Area</th>
                  <th className="px-5 py-4">Capability</th>
                  <th className="px-5 py-4">Operational Impact</th>
                  <th className="px-5 py-4 sm:pr-6">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {blueprintRows.map((row) => {
                  const Icon = row.icon;
                  return (
                    <tr className="transition hover:bg-slate-50" key={row.area}>
                      <td className="px-5 py-5 sm:px-6">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                            <Icon aria-hidden="true" className="h-4 w-4" />
                          </span>
                          <span className="font-semibold text-slate-900">{row.area}</span>
                        </div>
                      </td>
                      <td className="px-5 py-5 font-medium text-slate-700">{row.capability}</td>
                      <td className="px-5 py-5 leading-6 text-slate-500">{row.impact}</td>
                      <td className="px-5 py-5 sm:pr-6">
                        <span className="inline-flex rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {row.priority}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
