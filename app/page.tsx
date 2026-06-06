import Hero from '@/components/sections/Hero';
import Pricing from '@/components/sections/Pricing';
import PricingGrid from '@/components/PricingGrid';
import AdvancedFeatures from '@/components/AdvancedFeatures';
import CompetitorComparison from '@/components/sections/CompetitorComparison';
import RevenueProjections from '@/components/sections/RevenueProjections';
import LaunchStrategyTimeline from '@/components/sections/LaunchTimeline';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0B0F17] text-white overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-hidden">
        <Hero />
        <Pricing />
        <PricingGrid />
        <AdvancedFeatures />
        <CompetitorComparison />
        <RevenueProjections />
        <LaunchStrategyTimeline />
      </div>
    </main>
  );
}
