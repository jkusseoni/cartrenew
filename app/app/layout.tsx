import GlobalApiStatusBar from "@/components/global-api-status";

/**
 * Embedded Shopify App Home layout.
 * App Bridge CDN is injected first in the root layout <head> (see app/layout.tsx)
 * when proxy sets x-shopify-embed — do NOT add another App Bridge <script> here.
 * No Clerk providers in this layout.
 */
export default function EmbeddedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <GlobalApiStatusBar />
      {children}
    </>
  );
}
