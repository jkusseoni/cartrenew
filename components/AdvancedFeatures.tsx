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
import ChatCheckout from "./features/ChatCheckout";
import RagChatbot from "./features/RagChatbot";
import SegmentationTest from "./features/SegmentationTest";
import VideoMessaging from "./features/VideoMessaging";

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
    impact: "Translate reminders, offers, and policy answers by market without rebuilding campaigns.",
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
    <section className="bg-neutral-950 px-4 py-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-indigo-300">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Advanced automation layer
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Future-ready recovery features for global SaaS scale
          </h2>
          <p className="mt-4 text-lg leading-8 text-neutral-400">
            Expand the core cart recovery stack with rich media, checkout-native conversations,
            context-aware AI support, and segmentation testing for cross-border merchants.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <VideoMessaging />
          <ChatCheckout />
          <RagChatbot />
          <SegmentationTest />
        </div>

        <div className="mt-14 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/50">
          <div className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-300">
              Blueprint matrix
            </p>
            <h3 className="mt-2 text-2xl font-bold text-white">Global SaaS Scaling Blueprint</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/70 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-5 py-4 sm:px-6">Scale Area</th>
                  <th className="px-5 py-4">Capability</th>
                  <th className="px-5 py-4">Operational Impact</th>
                  <th className="px-5 py-4 sm:pr-6">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 text-sm">
                {blueprintRows.map((row) => {
                  const Icon = row.icon;

                  return (
                    <tr className="transition hover:bg-neutral-800/40" key={row.area}>
                      <td className="px-5 py-5 sm:px-6">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-indigo-300">
                            <Icon aria-hidden="true" className="h-4 w-4" />
                          </span>
                          <span className="font-semibold text-white">{row.area}</span>
                        </div>
                      </td>
                      <td className="px-5 py-5 font-medium text-neutral-200">{row.capability}</td>
                      <td className="px-5 py-5 leading-6 text-neutral-400">{row.impact}</td>
                      <td className="px-5 py-5 sm:pr-6">
                        <span className="inline-flex rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-neutral-300">
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
