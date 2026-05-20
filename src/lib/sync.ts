"use client";

// Cycle 12: client-side sync engine. Drains the Dexie pending queue by
// POSTing each row to /api/submissions and removing the local copy on
// success. Idempotent per row (the server's POST does onConflictDoNothing
// on id) — a network blip that drops the response after the row landed
// is safe to retry on the next drain.
//
// Triggers: useSyncEngine() mounts a window 'online' listener, a 60s
// interval, and a one-shot drain on mount. Manual "Sync now" button
// calls drainOnce() directly. Only one drain runs at a time.
//
// Connectivity is a real HEAD ping to /api/health (navigator.onLine
// lies on iOS). If the ping fails, drainOnce returns without touching
// the queue — rows stay `pending` for the next trigger.

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  localDb,
  deletePending,
  setPendingStatus,
  type PendingRow,
} from "@/lib/db/local";

let inFlight: Promise<void> | null = null;

export async function ping(): Promise<boolean> {
  try {
    const res = await fetch("/api/health", {
      method: "HEAD",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function drainOnce(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const online = await ping();
      if (!online) return;

      const rows = await localDb.pending
        .where("status")
        .anyOf("pending", "failed")
        .toArray();

      for (const row of rows) {
        try {
          await setPendingStatus(row.id, "syncing");
        } catch {
          continue;
        }
        try {
          // Strip Dexie-only fields before sending. The server enforces
          // identity from the session and ignores anything else anyway,
          // but a smaller body is cleaner.
          const {
            status: _s,
            schemaVersion: _v,
            createdAtLocal: _c,
            lastAttemptAt: _a,
            lastError: _e,
            retryCount: _r,
            ...submission
          } = row;
          void _s; void _v; void _c; void _a; void _e; void _r;

          const res = await fetch("/api/submissions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(submission),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          await deletePending(row.id);
        } catch (err) {
          await setPendingStatus(row.id, "pending", {
            lastError:
              err instanceof Error ? err.message : "sync failed",
            retryCount: (row.retryCount ?? 0) + 1,
          });
        }
      }
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Mount once (e.g. in AppShell). Wires the online listener, interval,
 *  and initial drain. Safe to call repeatedly — guards in-flight. */
export function useSyncEngine() {
  useEffect(() => {
    void drainOnce();
    const onOnline = () => void drainOnce();
    window.addEventListener("online", onOnline);
    const t = setInterval(() => void drainOnce(), 60_000);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(t);
    };
  }, []);
}

export interface SyncStatus {
  pendingCount: number;
  syncing: boolean;
  hasFailed: boolean;
}

export function useSyncStatus(): SyncStatus {
  const rows = useLiveQuery<PendingRow[]>(
    () => localDb.pending.toArray(),
    [],
  );
  if (!rows) return { pendingCount: 0, syncing: false, hasFailed: false };
  return {
    pendingCount: rows.length,
    syncing: rows.some((r) => r.status === "syncing"),
    hasFailed: rows.some(
      (r) => r.status === "failed" || (r.retryCount ?? 0) > 0,
    ),
  };
}
