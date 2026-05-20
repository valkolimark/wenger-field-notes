import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  /* config options here */
};

// Cycle 12: serwist injects a precache manifest of build assets into the
// SW (app shell, JS/CSS, fonts, _next/static, etc.). SW source is
// src/app/sw.ts; output public/sw.js. Disabled in dev to avoid the
// "stale-build-in-cache" trap during HMR; enabled for production builds
// and Vercel deploys.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
