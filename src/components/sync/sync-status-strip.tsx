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
 * Cycle 13: extended to also surface the photo upload queue. The
 * combined line reads "⏳ N pending sync · M photo(s) uploading"
 * when both are non-zero; either side hides when zero. "Sync now"
 * drains both passes.
 *
 *   "✓ All synced"                              calm gray, no action
 *   "⏳ 3 pending sync"                         submissions only
 *   "⏳ 4 photo(s) uploading"                   photos only
 *   "⏳ 3 pending sync · 4 photo(s) uploading"  both
 */
export function SyncStatusStrip() {
  const {
    pendingCount,
    syncing,
    hasFailed,
    pendingPhotos,
    photosUploading,
    photosFailed,
  } = useSyncStatus();
  const [manualBusy, setManualBusy] = useState(false);

  async function onSyncNow() {
    setManualBusy(true);
    try {
      await drainOnce();
    } finally {
      setManualBusy(false);
    }
  }

  const busy = syncing || photosUploading || manualBusy;
  const anyFailed = hasFailed || photosFailed;
  const totalUnfinished = pendingCount + pendingPhotos;

  if (totalUnfinished === 0) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-black/8 bg-white/70 px-3 py-2 text-sm text-brand-navy/60">
        <Check size={16} aria-hidden className="text-brand-navy/55" />
        All synced
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-warm/40 bg-brand-warm-soft/60 px-3 py-2 text-sm text-brand-warm">
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
        <CloudOff size={16} aria-hidden />
        {pendingCount > 0 && <span>{pendingCount} pending sync</span>}
        {pendingCount > 0 && pendingPhotos > 0 && (
          <span aria-hidden className="text-brand-warm/60">
            ·
          </span>
        )}
        {pendingPhotos > 0 && (
          <span>
            {pendingPhotos} photo{pendingPhotos === 1 ? "" : "s"} uploading
          </span>
        )}
        {anyFailed && (
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
