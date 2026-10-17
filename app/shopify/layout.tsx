import GlobalApiStatusBar from "@/components/global-api-status";
import { brand } from "@/lib/brand";

export default function ShopifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {brand.isDefault ? <GlobalApiStatusBar /> : null}
      {children}
    </>
  );
}
