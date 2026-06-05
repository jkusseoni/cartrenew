import type { NextConfig } from "next";

type NextConfigWithBuildLintBypass = NextConfig & {
  eslint?: {
    ignoreDuringBuilds?: boolean;
  };
};

const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  cleanDistDir: true,
  output: undefined,
  images: {
    unoptimized: true,
  },
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
} satisfies NextConfigWithBuildLintBypass;

export default nextConfig;
