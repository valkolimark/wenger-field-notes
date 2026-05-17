"use client";

import { useEffect, useRef, useState } from "react";
import { useRep } from "@/components/shell/rep-context";
import { loadAllSubmissions, clearLegacySubmissions } from "@/lib/submissions";

/**
 * One-time backfill of any Cycle 4 `wenger.submissions.v1` entries into
 * Neon. The POST endpoint is idempotent on `id`, so re-runs are safe.
 * Drafts (`wenger.draft.*`) are never touched. Mounted once in the
 * (app) layout.
 */
export function MigrateLegacy() {
  const { rep } = useRep();
  const ran = useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current || !rep) return;
    ran.current = true;

    (async () => {
      const legacy = loadAllSubmissions();
      if (legacy.length === 0) return;

      let ok = 0;
      for (const sub of legacy) {
        try {
          const res = await fetch("/api/submissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sub),
          });
          if (res.ok) ok += 1;
        } catch {
          // network error — counts as not-ok, key is kept
        }
      }

      if (ok === legacy.length) {
        clearLegacySubmissions();
      } else {
        setToast(
          "Some saved visits couldn't sync — we'll try again next time.",
        );
        setTimeout(() => setToast(null), 4000);
      }
    })();
  }, [rep]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(4.25rem_+_env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-4"
    >
      <div className="max-w-sm rounded-full bg-brand-navy/90 px-4 py-2 text-center text-xs font-medium text-white shadow-lg">
        {toast}
      </div>
    </div>
  );
}
