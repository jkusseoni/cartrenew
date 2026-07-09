import CompetitorComparison from "@/components/sections/CompetitorComparison";
import Footer from "@/components/sections/Footer";

export default function ComparisonPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <div className="relative z-10 w-full flex flex-col pt-8">
        <CompetitorComparison />
        <Footer />
      </div>
    </main>
  );
}
