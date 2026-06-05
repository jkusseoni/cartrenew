import { BarChart3 } from 'lucide-react';

export default function SegmentationTest() {
  return (
    <div className="bg-neutral-950/40 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
          <BarChart3 className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">4. Audience Segmentation & A/B Testing</h3>
          <p className="text-xs text-neutral-500">Conversion Optimization Core Engine</p>
        </div>
      </div>

      <p className="text-sm text-neutral-400 leading-relaxed mb-6">
        Aapka steady **68% Recovery Rate** optimize hoga dynamic segment routing se. High-ticket abandoned orders directly high-priority nodes par automatic flow karenge, jabki alternative discount strings automatic A/B test split execute karengi.
      </p>

      {/* Simulation Bars */}
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs font-medium text-neutral-400 mb-1">
            <span>Template A (Direct Offer Hook)</span>
            <span className="text-emerald-400 font-bold">72% CR</span>
          </div>
          <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '72%' }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs font-medium text-neutral-400 mb-1">
            <span>Template B (FOMO Countdown Timer)</span>
            <span className="text-amber-400 font-bold">59% CR</span>
          </div>
          <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: '59%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
