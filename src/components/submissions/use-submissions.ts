"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Submission } from "@/lib/submissions";
import { localDb, type PendingRow } from "@/lib/db/local";

/**
 * Cycle 6 → Cycle 12: returns server submissions merged with any local
 * `pending` rows the rep has not yet synced. Each merged row carries an
 * optional `isPending` flag so the list / detail / edit UIs can branch
 * (badge, Dexie delete, branched save). Pending rows reactively flow
 * from `useLiveQuery(localDb.pending)` so adding/removing one from the
 * queue updates every consumer immediately (the tab-bar badge in
 * Checkpoint F depends on the same liveness).
 *
 * Dedupe: server rows win (they are canonical). A pending row sharing an
 * id with a server row only happens in a brief race after sync writes
 * the server side but before the local row is purged; we drop the
 * pending copy in that window.
 */
export type ListSubmission = Submission & { isPending?: boolean };

export function useSubmissions() {
  const [serverRows, setServerRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/submissions", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { submissions?: Submission[] };
      setServerRows(
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

  const pendingRows = useLiveQuery<PendingRow[]>(
    () => localDb.pending.toArray(),
    [],
  );

  const submissions = useMemo<ListSubmission[]>(() => {
    const out = new Map<string, ListSubmission>();
    for (const s of serverRows) out.set(s.id, s);
    if (pendingRows) {
      for (const p of pendingRows) {
        if (!out.has(p.id)) out.set(p.id, { ...p, isPending: true });
      }
    }
    return [...out.values()].sort((a, b) => {
      const da = new Date(a.visitDate).getTime();
      const db = new Date(b.visitDate).getTime();
      return db - da;
    });
  }, [serverRows, pendingRows]);

  return {
    submissions,
    loading,
    error,
    refresh,
    pendingCount: pendingRows?.length ?? 0,
  };
}
