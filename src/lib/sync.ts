"use client";

// Cycle 12: client-side sync engine. Drains the Dexie pending queue by
// POSTing each row to /api/submissions and removing the local copy on
// success. Idempotent per row (the server's POST does onConflictDoNothing
// on id) — a network blip that drops the response after the row landed
// is safe to retry on the next drain.
//
// Cycle 13: two-phase. After the submissions pass, a second pass uploads
// pending photos via @vercel/blob/client.upload(). Ordering guard:
// a photo whose parent submission is still in the Dexie pending store
// (i.e. the server hasn't seen the row yet) is skipped this drain so
// the photos table never references a nonexistent parent. Photos can
// also attach to already-synced submissions (rep adds one later); those
// upload on the next drain regardless of submissions pass activity.
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
import { upload } from "@vercel/blob/client";
import {
  localDb,
  deletePending,
  deleteLocalPhoto,
  setPendingStatus,
  setPhotoStatus,
  purgeOutdatedLocalState,
  type PendingRow,
  type LocalPhotoRow,
} from "@/lib/db/local";

let inFlight: Promise<void> | null = null;

// Cycle 13: photo retry cap. After 5 consecutive failures the row goes
// terminal `failed` and waits for an explicit manual retry from the UI
// (PhotoSheet "Retry" button). The submissions queue uses a different
// scheme (`pending` after every failure, retryCount climbs forever)
// which is fine for a low-volume queue but not for photo bytes that
// could blow up the device's IndexedDB quota if we never give up.
const PHOTO_RETRY_CAP = 5;

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

      await drainPendingSubmissions();
      // Photos pass runs even if the submissions pass was a no-op —
      // photos can attach to already-synced submissions.
      await drainPendingPhotos();
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

async function drainPendingSubmissions(): Promise<void> {
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
}

async function drainPendingPhotos(): Promise<void> {
  const rows = await localDb.photos
    .where("status")
    .anyOf("pending", "failed")
    .toArray();

  for (const row of rows) {
    // Ordering guard: never attach a photo to a submission whose
    // parent row hasn't reached Postgres yet. The pending store
    // is the source of truth for "not yet on the server" — synced
    // rows are deleted from Dexie immediately by drainPendingSubmissions.
    const parentStillLocal = await localDb.pending.get(row.submissionId);
    if (parentStillLocal) continue;

    // Defensive: a row without bytes can't be uploaded. This
    // shouldn't happen post-capture but handle the case gracefully
    // by dropping the row (rather than retrying forever).
    if (!row.blob) {
      await deleteLocalPhoto(row.id);
      continue;
    }

    try {
      await setPhotoStatus(row.id, "uploading");
    } catch {
      continue;
    }
    try {
      await upload(
        `photos/${row.submissionId}/${row.id}.jpg`,
        row.blob,
        {
          access: "private",
          handleUploadUrl: "/api/photos/upload",
          contentType: row.mimeType || "image/jpeg",
          clientPayload: JSON.stringify({
            photoId: row.id,
            submissionId: row.submissionId,
            caption: row.caption,
            mimeType: row.mimeType,
            fileSize: row.fileSize,
            width: row.width,
            height: row.height,
            takenAt: row.takenAt,
          }),
        },
      );
      // Server is canonical now. The detail view re-reads via the
      // /api/photos/[id]/file proxy; the local blob is freed.
      await deleteLocalPhoto(row.id);
    } catch (err) {
      const nextRetry = (row.retryCount ?? 0) + 1;
      const terminal = nextRetry >= PHOTO_RETRY_CAP;
      await setPhotoStatus(row.id, terminal ? "failed" : "pending", {
        lastError:
          err instanceof Error ? err.message : "upload failed",
        retryCount: nextRetry,
      });
    }
  }
}

/** UI affordance: manually retry a `failed` photo. Resets retryCount
 *  to 0 (gives the rep a fresh 5 attempts) and kicks the engine. */
export async function retryPhoto(id: string): Promise<void> {
  await setPhotoStatus(id, "pending", { retryCount: 0, lastError: undefined });
  void drainOnce();
}

/** Mount once (e.g. in AppShell). Wires the online listener, interval,
 *  and initial drain. Safe to call repeatedly — guards in-flight.
 *  Cycle 18: runs the one-shot Dexie schema-version purge BEFORE the
 *  first drain so any old-shape pending rows are dropped (won't 400 in
 *  flight) and old-shape drafts are dropped (won't crash the form). */
export function useSyncEngine() {
  useEffect(() => {
    void (async () => {
      await purgeOutdatedLocalState();
      void drainOnce();
    })();
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
  // Submissions queue (Cycle 12)
  pendingCount: number;
  syncing: boolean;
  hasFailed: boolean;
  // Cycle 13: photos queue
  pendingPhotos: number;
  photosUploading: boolean;
  photosFailed: boolean;
  /** Sum used by the Submissions tab badge — every "not yet on the
   *  server" thing the rep can see counts. */
  totalUnfinished: number;
}

const EMPTY_SYNC_STATUS: SyncStatus = {
  pendingCount: 0,
  syncing: false,
  hasFailed: false,
  pendingPhotos: 0,
  photosUploading: false,
  photosFailed: false,
  totalUnfinished: 0,
};

export function useSyncStatus(): SyncStatus {
  const subs = useLiveQuery<PendingRow[]>(
    () => localDb.pending.toArray(),
    [],
  );
  const pics = useLiveQuery<LocalPhotoRow[]>(
    () => localDb.photos.toArray(),
    [],
  );
  if (!subs || !pics) return EMPTY_SYNC_STATUS;
  return {
    pendingCount: subs.length,
    syncing: subs.some((r) => r.status === "syncing"),
    hasFailed: subs.some(
      (r) => r.status === "failed" || (r.retryCount ?? 0) > 0,
    ),
    pendingPhotos: pics.length,
    photosUploading: pics.some((r) => r.status === "uploading"),
    photosFailed: pics.some((r) => r.status === "failed"),
    totalUnfinished: subs.length + pics.length,
  };
}
