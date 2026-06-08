import Hero from '@/components/sections/Hero';
import PricingTable from '@/components/PricingTable';
import PricingGrid from '@/components/PricingGrid';
import AdvancedFeatures from '@/components/AdvancedFeatures';
import CompetitorComparison from '@/components/sections/CompetitorComparison';
import RevenueProjections from '@/components/sections/RevenueProjections';
import LaunchTimeline from '@/components/sections/LaunchTimeline';
import Footer from '@/components/sections/Footer'; 

export default function Home() {
  return (
    // Fixed: Wrapper se max-w limit hatayi taaki background pure screen par stretch ho sake
    <main className="min-h-screen bg-[#0B0F17] text-white overflow-x-hidden w-full">
      <Hero />
      <PricingTable />
      <PricingGrid />
      <AdvancedFeatures />
      <CompetitorComparison />
      <RevenueProjections />
      <LaunchTimeline />
      <Footer />
    </main>
  );
}