import AdvancedFeatures from "@/components/AdvancedFeatures";
import PricingTable from "@/components/Pricingtable";
import CompetitorComparison from "@/components/sections/CompetitorComparison";
import Footer from "@/components/sections/Footer";
import Hero from "@/components/sections/Hero";
import LaunchTimeline from "@/components/sections/LaunchTimeline";
import Navigation from "@/components/sections/Navigation";
import RevenueProjections from "@/components/sections/RevenueProjections";
​export default function HomePage() {
return (
<main className="min-h-screen bg-[#030712] text-white flex flex-col scroll-smooth selection:bg-blue-500/30 selection:text-white overflow-x-hidden w-full relative">
​{/* 🔮 पूरे पेज के लिए एक हल्का और प्रीमियम बैकग्राउंड ग्लो ग्रिड */}
<div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
<div className="absolute top-[10%] left-[5%] w-[800px] h-[800px] bg-blue-600/[0.03] blur-[150px] rounded-full mix-blend-screen" />
<div className="absolute top-[40%] right-[5%] w-[700px] h-[700px] bg-indigo-500/[0.02] blur-[130px] rounded-full mix-blend-screen" />
<div className="absolute top-[70%] left-[10%] w-[600px] h-[600px] bg-emerald-500/[0.01] blur-[120px] rounded-full mix-blend-screen" />
</div>
​{/* 🚀 मुख्य पेज कंपोनेंट्स का स्मूथ फ्लो */}
<div className="relative z-10 w-full flex flex-col">
<Navigation />
<Hero />
​<div className="w-full relative">
<PricingTable />
</div>
​<AdvancedFeatures />
<CompetitorComparison />
<RevenueProjections />
<LaunchTimeline />
<Footer />
</div>
</main>
);
}