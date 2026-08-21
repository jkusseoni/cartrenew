import GlobalApiStatusBar from "@/components/global-api-status";

/**
 * Embedded Shopify App Home layout.
 * App Bridge is bootstrapped from the root layout so Next.js can place its
 * configuration and beforeInteractive script in the document head.
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
