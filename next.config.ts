import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "cartrenew.com",
          },
        ],
        destination: "https://www.cartrenew.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;