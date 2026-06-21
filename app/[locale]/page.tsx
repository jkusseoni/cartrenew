import AdvancedFeatures from "@/components/AdvancedFeatures";
import PricingTable from "@/components/Pricingtable";
import CompetitorComparison from "@/components/sections/CompetitorComparison";
import Footer from "@/components/sections/Footer";
import Hero from "@/components/sections/Hero";
import LaunchTimeline from "@/components/sections/LaunchTimeline";
import Navigation from "@/components/sections/Navigation";
import RevenueProjections from "@/components/sections/RevenueProjections";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0B0F17] text-white flex flex-col scroll-smooth selection:bg-emerald-500/30 selection:text-white overflow-x-hidden w-full">
      <Navigation />
      <Hero />

      <div className="w-full relative z-10">
        <PricingTable />
      </div>

      <AdvancedFeatures />
      <CompetitorComparison />
      <RevenueProjections />
      <LaunchTimeline />
      <Footer />
    </main>
  );
}