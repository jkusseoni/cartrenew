import AdvancedFeatures from "@/components/AdvancedFeatures";
import PricingTable from "@/components/Pricingtable";
import CompetitorComparison from "@/components/sections/CompetitorComparison";
import DashboardPreview from "@/components/sections/DashboardPreview";
import Footer from "@/components/sections/Footer";
import Hero from "@/components/sections/Hero";
import LaunchTimeline from "@/components/sections/LaunchTimeline";
import RevenueProjections from "@/components/sections/RevenueProjections";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-x-hidden scroll-smooth bg-slate-50 text-slate-800 selection:bg-pink-200 selection:text-pink-900">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[5%] h-[900px] w-[900px] rounded-full bg-blue-100/40 blur-[160px] mix-blend-multiply" />
        <div className="absolute right-[-10%] top-[35%] h-[800px] w-[800px] rounded-full bg-pink-100/40 blur-[150px] mix-blend-multiply" />
        <div className="absolute left-[5%] top-[65%] h-[700px] w-[700px] rounded-full bg-emerald-100/30 blur-[140px] mix-blend-multiply" />
        <div className="absolute bottom-[5%] right-[10%] h-[600px] w-[600px] rounded-full bg-indigo-100/40 blur-[130px] mix-blend-multiply" />
      </div>

      <div className="relative z-10 flex w-full flex-col">
        <Hero />

        <div className="relative w-full">
          <PricingTable />
        </div>

        <AdvancedFeatures />
        <CompetitorComparison />
        <DashboardPreview />
        <RevenueProjections />
        <LaunchTimeline />
        <Footer />
      </div>
    </main>
  );
}