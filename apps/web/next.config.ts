import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";
const browserApiBase =
  process.env.NEXT_PUBLIC_API_URL ??
  (production ? "/api" : "http://localhost:4000");
const apiUrl = new URL(browserApiBase, "http://localhost:3000");
if (
  production &&
  browserApiBase !== "/api" &&
  apiUrl.protocol !== "https:"
) {
  throw new Error(
    "NEXT_PUBLIC_API_URL must be /api or an HTTPS URL in production",
  );
}
const imageProtocol = apiUrl.protocol === "https:" ? "https" : "http";
const imagePathPrefix = apiUrl.pathname.replace(/\/$/, "");
const configuredApiProxyTarget = process.env.API_PROXY_TARGET?.trim();
if (production && !configuredApiProxyTarget) {
  throw new Error("API_PROXY_TARGET is required in production");
}
const apiProxyTarget = (
  configuredApiProxyTarget ?? "http://localhost:4000"
).replace(/\/$/, "");
const parsedApiProxyTarget = new URL(apiProxyTarget);
if (
  parsedApiProxyTarget.protocol !== "http:" &&
  parsedApiProxyTarget.protocol !== "https:"
) {
  throw new Error("API_PROXY_TARGET must use http or https");
}
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
