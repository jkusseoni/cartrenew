import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
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
