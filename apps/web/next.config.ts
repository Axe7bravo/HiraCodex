import type { NextConfig } from "next";

const browserApiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const apiUrl = new URL(browserApiBase, "http://localhost:3000");
const imageProtocol = apiUrl.protocol === "https:" ? "https" : "http";
const imagePathPrefix = apiUrl.pathname.replace(/\/$/, "");
const apiProxyTarget = (
  process.env.API_PROXY_TARGET ?? "http://localhost:4000"
).replace(/\/$/, "");
const externalDevOrigin = process.env.EXTERNAL_DEV_ORIGIN?.trim();
const allowedDevOrigins =
  process.env.NODE_ENV === "development" && externalDevOrigin
    ? [externalDevHostname(externalDevOrigin)]
    : [];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
  images: {
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    localPatterns: [
      {
        pathname: "/images/**",
      },
      {
        pathname: `${imagePathPrefix}/discovery/properties/**`,
      },
    ],
    remotePatterns: [
      {
        protocol: imageProtocol,
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: `${imagePathPrefix}/discovery/properties/**`,
      },
    ],
  },
};

function externalDevHostname(origin: string): string {
  const parsed = new URL(origin);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("EXTERNAL_DEV_ORIGIN must use http or https");
  }
  return parsed.hostname;
}

export default nextConfig;
