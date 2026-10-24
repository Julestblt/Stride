import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.PLAYWRIGHT_TEST
    ? { distDir: ".next-e2e" }
    : { output: "standalone" }),
  allowedDevOrigins: [
    "127.0.0.1",
    ...(process.env.ALLOWED_DEV_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ],
  async redirects() {
    return [
      { source: "/coach/equipe", destination: "/coach/team", permanent: true },
      { source: "/coach/nouvelle", destination: "/coach/new", permanent: true },
      {
        source: "/plan/historique",
        destination: "/plan/history",
        permanent: true,
      },
      {
        source: "/plan",
        has: [{ type: "query", key: "proposition", value: "(?<id>.+)" }],
        destination: "/plan?proposal=:id",
        permanent: true,
      },
      {
        source: "/plan",
        has: [{ type: "query", key: "seance", value: "(?<key>.+)" }],
        destination: "/plan?session=:key",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
    proxyClientMaxBodySize: "21mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
