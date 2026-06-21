import GlobalApiStatusBar from "@/components/global-api-status";

export default function ShopifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalApiStatusBar />
      {children}
    </>
  );
}
