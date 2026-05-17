"use client";

import { useCallback, useEffect, useState } from "react";
import type { Submission } from "@/lib/submissions";

/**
 * Cycle 5: submissions now come from Neon via /api/submissions. Same
 * exported name/shape as the Cycle 4 hook (consuming pages unchanged),
 * with `error` + `refresh` added. Revalidates on mount and window focus;
 * on error keeps last-known data and surfaces a human message.
 */
export function useSubmissions(repId: string) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!repId) {
      setSubmissions([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await fetch(
        `/api/submissions?repId=${encodeURIComponent(repId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { submissions?: Submission[] };
      setSubmissions(
        Array.isArray(data.submissions) ? data.submissions : [],
      );
    } catch {
      // Keep last-known data; surface a human message.
      setError("Couldn't load submissions — pull to refresh.");
    } finally {
      setLoading(false);
    }
  }, [repId]);

  // Initial load (shows the skeleton via `loading`).
  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  // Revalidate when the tab regains focus (no skeleton flash — `loading`
  // stays false so we silently refresh in the background).
  useEffect(() => {
    function onFocus() {
      void refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return { submissions, loading, error, refresh };
}
