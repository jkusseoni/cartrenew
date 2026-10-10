import { Link } from "@/i18n/routing";
import { brand } from "@/lib/brand";
import { shopifyAppStoreListingHref } from "@/lib/marketing/shopify-listing";
import Footer from "@/components/sections/Footer";

const legalLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
  { href: "/data-deletion", label: "Data deletion" },
] as const;

export default function PingzaHome() {
  const listingUrl = shopifyAppStoreListingHref();

  return (
    <main className="flex min-h-screen w-full flex-col bg-slate-50 text-slate-800">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-24">
        <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
          {brand.name} recovers abandoned carts on WhatsApp and email.
        </h1>
        <p className="text-base font-medium leading-relaxed text-slate-500 sm:text-lg">
          {brand.name} reminds shoppers who left checkout, on WhatsApp and email.
        </p>

        {listingUrl ? (
          <a
            href={listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Install from the Shopify App Store
          </a>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-slate-300 px-6 py-3 text-sm font-black text-slate-500"
            >
              Install from the Shopify App Store
            </button>
            <p className="text-sm font-medium text-slate-500">Coming soon</p>
          </div>
        )}

        <p className="text-sm font-medium text-slate-600">
          Already installed? Open {brand.name} from your Shopify admin.
        </p>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-slate-600">
          {legalLinks.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-slate-900">
              {item.label}
            </Link>
          ))}
          <a href={`mailto:${brand.supportEmail}`} className="hover:text-slate-900">
            {brand.supportEmail}
          </a>
        </nav>
      </div>
      <Footer />
    </main>
  );
}
