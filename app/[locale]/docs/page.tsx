import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import Footer from "@/components/sections/Footer";

export default async function DocsPage() {
  const t = await getTranslations("nav");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <div className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <p className="text-xs font-black uppercase tracking-widest text-blue-600">
          {t("docs")}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          CartRenew documentation
        </h1>
        <p className="mt-4 text-sm font-medium text-slate-500">
          Quick links to the product surfaces you need while setting up WhatsApp cart recovery.
        </p>

        <ul className="mt-10 space-y-3">
          {[
            { href: "/pricing" as const, label: t("pricing"), hint: "Plans, billing, and Meta conversation rates" },
            { href: "/comparison" as const, label: t("comparison"), hint: "How CartRenew compares to agent platforms" },
            { href: "/dashboard" as const, label: t("dashboard"), hint: "Live recovery analytics and store controls" },
            { href: "/sign-up" as const, label: t("signup"), hint: "Start a 14-day free trial" },
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <span className="text-sm font-black text-slate-900">{item.label}</span>
                <span className="mt-1 block text-xs font-medium text-slate-500">{item.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Footer />
    </main>
  );
}
