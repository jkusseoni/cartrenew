import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/shopify/api/webhooks/:path*",
        destination: "/api/webhooks/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        // Embedded App Home — allow Shopify Admin iframe.
        // Do NOT set X-Frame-Options (it would override CSP frame-ancestors).
        source: "/app",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors https://admin.shopify.com https://*.myshopify.com;",
          },
        ],
      },
      {
        source: "/app/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors https://admin.shopify.com https://*.myshopify.com;",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
