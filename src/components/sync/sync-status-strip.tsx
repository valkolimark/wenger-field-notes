"use client";

import { useState } from "react";
import { Check, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { drainOnce, useSyncStatus } from "@/lib/sync";

/**
 * Cycle 12: queue-state strip on the `/submissions` screen only (the
 * header stays untouched). Pulls reactive state from Dexie via
 * useSyncStatus — no extra polling.
 *
 *   "✓ All synced"             calm gray, no action (count === 0)
 *   "⏳ N pending sync"        warm `#b8612a` + Sync now button
 *
 * The Sync now button calls drainOnce(); the UI flips back to "All
 * synced" automatically as rows are POSTed and deleted from Dexie.
 */
export function SyncStatusStrip() {
  const { pendingCount, syncing, hasFailed } = useSyncStatus();
  const [manualBusy, setManualBusy] = useState(false);

  async function onSyncNow() {
    setManualBusy(true);
    try {
      await drainOnce();
    } finally {
      setManualBusy(false);
    }
  }

  const busy = syncing || manualBusy;

  if (pendingCount === 0) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-black/8 bg-white/70 px-3 py-2 text-sm text-brand-navy/60">
        <Check size={16} aria-hidden className="text-brand-navy/55" />
        All synced
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-warm/40 bg-brand-warm-soft/60 px-3 py-2 text-sm text-brand-warm">
      <span className="inline-flex items-center gap-2 font-medium">
        <CloudOff size={16} aria-hidden />
        {pendingCount} pending sync
        {hasFailed && (
          <span className="rounded-full bg-brand-warm/10 px-1.5 py-0.5 text-[11px] uppercase tracking-wide">
            retrying
          </span>
        )}
      </span>
      <Button
        variant="secondary"
        onClick={onSyncNow}
        disabled={busy}
        className="h-9 border-brand-warm/40 px-3 text-xs text-brand-warm hover:border-brand-warm/70 hover:bg-brand-warm/5 hover:text-brand-warm"
      >
        <RefreshCw
          size={14}
          aria-hidden
          className={busy ? "animate-spin" : ""}
        />
        {busy ? "Syncing…" : "Sync now"}
      </Button>
    </div>
  );
}
