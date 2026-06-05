import type { NextConfig } from "next";

type DeploymentNextConfig = NextConfig & {
  eslint?: {
    ignoreDuringBuilds?: boolean;
  };
};

const nextConfig: DeploymentNextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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
