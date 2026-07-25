import GlobalApiStatusBar from "@/components/global-api-status";

/**
 * Embedded Shopify App Home layout.
 * App Bridge must be the first script in <head> (sync, no async/defer) so
 * Shopify's embedded-app checks and session tokens work. No Clerk here.
 */
export default function EmbeddedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const apiKey =
    process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ||
    process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID ||
    process.env.SHOPIFY_API_KEY ||
    "";

  return (
    <>
      <head>
        <script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          data-api-key={apiKey}
        />
      </head>
      <GlobalApiStatusBar />
      {children}
    </>
  );
}
