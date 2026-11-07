import { redirect } from "@/i18n/routing";
import { brand } from "@/lib/brand";

export default async function SignUpLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Pingza merchants install from the Shopify App Store; there is no separate sign-up.
  if (!brand.isDefault) {
    const { locale } = await params;
    redirect({ href: "/", locale });
  }

  return <>{children}</>;
}
