import PingzaHome from "@/components/marketing/PingzaHome";
import PricingTable from "@/components/Pricingtable";
import Footer from "@/components/sections/Footer";
import { brand } from "@/lib/brand";

export default function PricingPage() {
  if (!brand.isDefault) {
    return <PingzaHome />;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <div className="relative z-10 w-full flex flex-col pt-8">
        <PricingTable />
        <Footer />
      </div>
    </main>
  );
}
