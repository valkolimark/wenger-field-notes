"use client";

import { useCallback, useEffect, useState } from "react";
import type { Submission } from "@/lib/submissions";

/**
 * Cycle 6: the API scopes by the authenticated session (rep sees own,
 * admin sees all) — the client no longer passes a repId. Revalidates on
 * mount and window focus; keeps last-known data on error.
 */
export function useSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/submissions", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { submissions?: Submission[] };
      setSubmissions(
        Array.isArray(data.submissions) ? data.submissions : [],
      );
    } catch {
      setError("Couldn't load submissions — pull to refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onFocus() {
      void refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return { submissions, loading, error, refresh };
}
