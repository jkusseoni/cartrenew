import { Link } from "@/i18n/routing";

export default function SupportPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-16 text-slate-800">
      <p className="text-xs font-black uppercase tracking-widest text-blue-600">Support</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
        CartRenew Support
      </h1>
      <p className="mt-4 text-sm font-medium leading-relaxed text-slate-500">
        We help Shopify merchants set up WhatsApp cart recovery, billing, and store integrations.
        Typical response time is within 1 business day.
      </p>

      <section className="mt-10 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-sm font-black text-slate-900">Email</h2>
          <a
            href="mailto:contact@cartrenew.com"
            className="mt-1 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            contact@cartrenew.com
          </a>
        </div>
        <div>
          <h2 className="text-sm font-black text-slate-900">Common topics</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Installing CartRenew on a Shopify store</li>
            <li>Approving or changing a Shopify Billing subscription</li>
            <li>WhatsApp / Meta Business API connection</li>
            <li>Webhook delivery and abandoned cart recovery</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/docs"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white transition hover:bg-blue-700"
          >
            Open Docs
          </Link>
          <Link
            href="/privacy"
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-50"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-50"
          >
            Terms of Service
          </Link>
        </div>
      </section>
    </main>
  );
}
