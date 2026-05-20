"use client";

import { useEffect } from "react";

/**
 * Cycle 12: client-side registration for the serwist-managed SW
 * (public/sw.js). Disabled in dev (matches next.config.ts `disable:
 * NODE_ENV==='development'`). Safe to mount in the root layout — the
 * register call is idempotent (the browser dedupes by scope).
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err: unknown) => {
        // Not fatal — app still works online without offline caching.
        console.warn("[sw] register failed", err);
      });
  }, []);
  return null;
}
