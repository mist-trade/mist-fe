import type { NextConfig } from "next";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const rewrites = [];
    const mistTarget = process.env.MIST_API_PROXY_TARGET;
    const chanTarget = process.env.CHAN_API_PROXY_TARGET;

    if (mistTarget) {
      rewrites.push({
        source: "/api/mist/:path*",
        destination: `${trimTrailingSlash(mistTarget)}/:path*`,
      });
    }

    if (chanTarget) {
      rewrites.push({
        source: "/api/chan/:path*",
        destination: `${trimTrailingSlash(chanTarget)}/:path*`,
      });
    }

    return rewrites;
  },
};

export default nextConfig;
