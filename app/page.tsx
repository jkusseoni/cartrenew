import { redirect } from "next/navigation";

import { routing } from "@/i18n/routing";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // Shopify opens the app URL with a `shop` param — route those visits to the
  // standalone Shopify console instead of the marketing landing page.
  const shop = typeof params.shop === "string" ? params.shop : undefined;
  if (shop) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") query.set(key, value);
      else if (Array.isArray(value) && value[0] != null) query.set(key, value[0]);
    }
    redirect(`/shopify?${query.toString()}`);
  }

  redirect(`/${routing.defaultLocale}`);
}
