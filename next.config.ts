import type { NextConfig } from "next";

/**
 * Two build targets from one codebase:
 * - default: the full server app (SQLite, accounts, encrypted images on disk).
 * - PSL_STATIC=1: the browser edition for static hosting such as GitHub Pages
 *   (`npm run build:static`). Only `*.static.tsx` route files are used, and every
 *   module with a `*.static.ts(x)` sibling is replaced by it (browser data layer).
 */
const STATIC = process.env.PSL_STATIC === "1";
const BASE_PATH = STATIC ? (process.env.PSL_BASE_PATH ?? "").replace(/\/$/, "") : "";

const serverConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // better-sqlite3 is a native module and must not be bundled.
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      {
        // Long-lived caching for the vendored ML runtime and model (content never changes per version).
        source: "/(mediapipe|models)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

const staticConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  distDir: process.env.PSL_STATIC_DIST ?? "out",
  trailingSlash: true,
  basePath: BASE_PATH || undefined,
  pageExtensions: ["static.tsx", "static.ts"],
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_PSL_STATIC: "1", NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  turbopack: {
    resolveExtensions: [".static.tsx", ".static.ts", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
};

export default STATIC ? staticConfig : serverConfig;
