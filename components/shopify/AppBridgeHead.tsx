type AppBridgeHeadProps = {
  apiKey: string;
  host?: string;
  /** Only load App Bridge inside the Shopify Admin iframe (host param present). */
  embedded: boolean;
};

/**
 * App Bridge v4 bootstrap — only injected for embedded Admin loads.
 * Standalone dev URLs (`?shop=` only) skip App Bridge to avoid iframe errors.
 */
export function AppBridgeHead({ apiKey, host, embedded }: AppBridgeHeadProps) {
  if (!embedded || !apiKey || !host) return null;

  return (
    <>
      <meta name="shopify-api-key" content={apiKey} />
      <meta name="shopify-app-host" content={host} />
      <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" async />
    </>
  );
}
