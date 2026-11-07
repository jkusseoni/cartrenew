import LanguageSwitcher from "@/components/LanguageSwitcher";
import { redirect } from "@/i18n/routing";
import { brand } from "@/lib/brand";

export default async function SignInLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Pingza merchants sign in through the Shopify admin, not this page.
  if (!brand.isDefault) {
    const { locale } = await params;
    redirect({ href: "/", locale });
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute right-4 top-4 z-50 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  );
}
