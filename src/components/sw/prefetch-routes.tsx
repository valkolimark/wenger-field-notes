"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { schools } from "@/lib/schools";

/**
 * Cycle 12 follow-up: once the rep is authenticated, ask the SW to
 * prefetch the canonical offline routes — including ONE real
 * /form/<schoolId> — using the auth cookie that's now in the jar.
 * This is what makes "tap Start visit offline" work: the form route is
 * dynamic per-school, so the SW's /form/* prefix-fallback needs at
 * least one cached form entry to serve any other school's URL from.
 *
 * Idempotent across renders; runs once per auth-session start.
 */
export function PrefetchOfflineRoutes() {
  const { status } = useSession();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (status !== "authenticated") return;
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    fired.current = true;

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sample = schools[0]?.id;
        // Cycle 16: include /submissions template URLs so a rep can
        // open + edit a pending visit offline without first visiting
        // those pages online. Both routes render identical server HTML
        // regardless of id (the client component reads useParams() and
        // loads the row from API or Dexie), so one cached entry per
        // pattern satisfies the SW's nav fallback for any real id.
        const urls = [
          "/map",
          "/submissions",
          "/account",
          ...(sample ? [`/form/${sample}`] : []),
          "/submissions/__prefetch__",
          "/submissions/__prefetch__/edit",
        ];
        const sw =
          reg.active ?? reg.waiting ?? reg.installing;
        sw?.postMessage({ type: "PREFETCH", urls });
      } catch {
        /* SW not ready / not supported — non-fatal */
      }
    })();
  }, [status]);

  return null;
}
