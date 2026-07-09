import { BarChart3 } from "lucide-react";

export default function SegmentationTest() {
  return (
    <div className="min-h-[280px] rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200 bg-amber-50">
          <BarChart3 className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">4. Audience Segmentation & A/B Testing</h3>
          <p className="text-xs text-slate-500">Conversion Optimization Core Engine</p>
        </div>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-slate-600">
        Keep your 68% recovery rate climbing with dynamic segment routing. High-ticket abandoned
        orders flow to priority nodes, while alternate discount strings run automatic A/B splits.
      </p>

      <div className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
            <span>Template A (Direct Offer Hook)</span>
            <span className="font-bold text-emerald-600">72% CR</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: "72%" }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
            <span>Template B (FOMO Countdown Timer)</span>
            <span className="font-bold text-amber-600">59% CR</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-amber-500" style={{ width: "59%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
