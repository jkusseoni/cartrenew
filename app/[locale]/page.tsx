import AdvancedFeatures from "@/components/AdvancedFeatures";
import PricingTable from "@/components/Pricingtable";
import CompetitorComparison from "@/components/sections/CompetitorComparison";
import Footer from "@/components/sections/Footer";
import Hero from "@/components/sections/Hero";
import LaunchTimeline from "@/components/sections/LaunchTimeline";
import RevenueProjections from "@/components/sections/RevenueProjections";

export default function HomePage() {
  return (
    // ✨ सॉफ़्ट लाइट बैकग्राउंड और डार्क ग्रे/स्लेट टेक्स्ट फॉर प्रीमियम रीडेबिलिटी
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col scroll-smooth selection:bg-pink-200 selection:text-pink-900 overflow-x-hidden w-full relative">
      
      {/* 🔮 🌸 🧪 पूरे पेज के लिए हल्का Light Pink, Light Green, और Light Blue एम्बिएंट ग्लो ग्रिड */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* हल्का लाइट ब्लू ग्लो */}
        <div className="absolute top-[5%] left-[-10%] w-[900px] h-[900px] bg-blue-100/40 blur-[160px] rounded-full mix-blend-multiply" />
        
        {/* सॉफ़्ट लाइट पिंक ग्लो */}
        <div className="absolute top-[35%] right-[-10%] w-[800px] h-[800px] bg-pink-100/40 blur-[150px] rounded-full mix-blend-multiply" />
        
        {/* कोमल लाइट ग्रीन ग्लो */}
        <div className="absolute top-[65%] left-[5%] w-[700px] h-[700px] bg-emerald-100/30 blur-[140px] rounded-full mix-blend-multiply" />
        
        {/* एक और सॉफ़्ट ब्लू-इंडिगो टच बॉटम में */}
        <div className="absolute bottom-[5%] right-[10%] w-[600px] h-[600px] bg-indigo-100/40 blur-[130px] rounded-full mix-blend-multiply" />
      </div>

      {/* 🚀 मुख्य पेज कंपोनेंट्स का स्मूथ फ्लो */}
      <div className="relative z-10 w-full flex flex-col">
        {/* 🌟 पुराने <Navigation /> को यहाँ से हटा दिया गया है, अब डबल नेवबार बिल्कुल नहीं दिखेगा */}
        <Hero />
        
        <div className="w-full relative">
          <PricingTable />
        </div>

        <AdvancedFeatures />
        <CompetitorComparison />
        <RevenueProjections />
        <LaunchTimeline />
        <Footer />
      </div>
    </main>
  );
}