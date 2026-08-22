/**
 * @deprecated App Bridge v4 auto-initializes from the root layout CDN script
 * (`data-api-key` on the first <script> in <head>). Do not inject a second
 * async script or legacy host meta — that fails Shopify's first-script check
 * and triggers "deprecated parameters" warnings.
 */
export function AppBridgeHead(_props: {
  apiKey: string;
  host?: string;
  embedded: boolean;
}) {
  return null;
}
