// Cycle 12: client-side IndexedDB via Dexie. Two stores back the
// offline-first flow:
//   drafts            — in-progress forms (write-ahead of the visit form)
//   pending_submissions — finished visits queued for sync to Neon
//
// Cycle 13 adds a third store:
//   photos — captured-but-not-yet-uploaded photo blobs (write-ahead of
//            Vercel Blob). Linkage is one-way: each photo points at a
//            submissionId. The pending submission row itself is
//            unchanged — `PendingRow`'s on-the-wire shape doesn't gain
//            `photoIds`, so `PENDING_SCHEMA_VERSION` stays at 1.
//
// The Cycle-4 localStorage drafts (`wenger.draft.*`) are NOT migrated
// (drafts are device-local/ephemeral by design; orphan keys decay).
// Server is canonical for synced rows; local rows are write-ahead cache.

import Dexie, { type Table } from "dexie";
import type { Submission, VisitFormData } from "@/lib/submissions";

export type PendingStatus = "pending" | "syncing" | "synced" | "failed";

// Current pending_submissions shape revision. Bump when the queued
// submission payload changes; the sync engine / server can detect old
// shapes and migrate or reject (groundwork only this cycle).
export const PENDING_SCHEMA_VERSION = 1;

// Cycle 13: photo row shape revision. Independent of submissions; bump
// when the local photo payload changes.
export const PHOTOS_SCHEMA_VERSION = 1;

export interface DraftRow {
  /** `${repId}__${schoolId}` — composite primary key. */
  key: string;
  repId: string;
  schoolId: string;
  data: VisitFormData;
  updatedAt: string; // ISO
}

export interface PendingRow extends Submission {
  status: PendingStatus;
  /** Snapshot of PENDING_SCHEMA_VERSION at the time the row was created. */
  schemaVersion: number;
  createdAtLocal: string; // ISO — when the rep saved it on the device
  lastAttemptAt?: string;
  lastError?: string;
  retryCount?: number;
}

// Cycle 13: status flow for a photo's local lifecycle.
//   pending   → captured, awaiting upload
//   uploading → put() in flight to Vercel Blob
//   uploaded  → transient; rows are deleted immediately on upload success
//               (server is canonical — the UI re-reads via the
//               /api/photos/[id]/file proxy)
//   failed    → terminal soft-error (retryable on next drain; flips to
//               `failed` only after retryCount >= 5)
export type LocalPhotoStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "failed";

export interface LocalPhotoRow {
  /** Client-generated UUID; matches the eventual server-side photos.id. */
  id: string;
  /** Submission this photo belongs to. May reference a Dexie pending row
   *  OR an already-synced Postgres submission (rep adds a photo later). */
  submissionId: string;
  /** Compressed image bytes. Cleared (set to undefined and the row
   *  deleted) once the upload succeeds — server becomes canonical. */
  blob?: Blob;
  /** ~240px-wide JPEG data URL captured at compression time. Survives
   *  reload because Blobs alone may be cumbersome to render without an
   *  active Object URL after rehydration; this is the cheap instant
   *  preview. */
  thumbnailDataUrl?: string;
  caption: string;
  mimeType: string;
  fileSize: number; // bytes, post-compression
  width?: number;
  height?: number;
  takenAt: string; // ISO
  status: LocalPhotoStatus;
  /** Snapshot of PHOTOS_SCHEMA_VERSION at the time the row was created. */
  schemaVersion: number;
  createdAtLocal: string; // ISO — when the rep captured it on the device
  lastAttemptAt?: string;
  lastError?: string;
  retryCount?: number;
}

class LocalDB extends Dexie {
  drafts!: Table<DraftRow, string>;
  pending!: Table<PendingRow, string>;
  photos!: Table<LocalPhotoRow, string>;

  constructor() {
    super("wenger-fieldnotes");
    // v1 (Cycle 12) — drafts + pending. Kept intact; Dexie auto-upgrades
    // by adding the new store without touching existing data.
    this.version(1).stores({
      // & = unique primary; trailing fields = secondary indexes
      drafts: "&key, repId, schoolId, updatedAt",
      pending: "&id, repId, status, createdAtLocal",
    });
    // v2 (Cycle 13) — add photos store. Existing v1 data survives.
    this.version(2).stores({
      drafts: "&key, repId, schoolId, updatedAt",
      pending: "&id, repId, status, createdAtLocal",
      photos: "&id, submissionId, status, createdAtLocal",
    });
  }
}

export const localDb = new LocalDB();

const hasBrowserDb = () =>
  typeof window !== "undefined" && typeof indexedDB !== "undefined";

// --- drafts (per rep + school) ----------------------------------------

export const draftKey = (repId: string, schoolId: string) =>
  `${repId}__${schoolId}`;

export async function loadDraft(
  repId: string,
  schoolId: string,
): Promise<DraftRow | null> {
  if (!hasBrowserDb()) return null;
  try {
    return (await localDb.drafts.get(draftKey(repId, schoolId))) ?? null;
  } catch {
    return null;
  }
}

export async function saveDraft(
  repId: string,
  schoolId: string,
  data: VisitFormData,
): Promise<void> {
  if (!hasBrowserDb()) return;
  try {
    await localDb.drafts.put({
      key: draftKey(repId, schoolId),
      repId,
      schoolId,
      data,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    /* device storage hiccup — non-fatal */
  }
}

export async function clearDraft(
  repId: string,
  schoolId: string,
): Promise<void> {
  if (!hasBrowserDb()) return;
  try {
    await localDb.drafts.delete(draftKey(repId, schoolId));
  } catch {
    /* ignore */
  }
}

// --- pending submissions (offline write-ahead queue) ------------------
// Server is canonical; a pending row exists only between "rep tapped
// Save" and "sync engine drained it". Status flow:
//   pending  → enqueued, awaiting sync
//   syncing  → POST in-flight; edits/deletes redirect to online flow
//   synced   → transient; rows are deleted immediately on POST 200
//   failed   → terminal soft-error (retryable; sync engine resets to
//              pending on next drain)

export async function enqueuePending(
  sub: Submission,
): Promise<PendingRow> {
  if (!hasBrowserDb()) {
    throw new Error("Local DB unavailable (server context).");
  }
  const row: PendingRow = {
    ...sub,
    status: "pending",
    schemaVersion: PENDING_SCHEMA_VERSION,
    createdAtLocal: new Date().toISOString(),
    retryCount: 0,
  };
  await localDb.pending.put(row);
  return row;
}

export async function getPending(id: string): Promise<PendingRow | null> {
  if (!hasBrowserDb()) return null;
  try {
    return (await localDb.pending.get(id)) ?? null;
  } catch {
    return null;
  }
}

export async function getAllPending(): Promise<PendingRow[]> {
  if (!hasBrowserDb()) return [];
  try {
    return await localDb.pending.toArray();
  } catch {
    return [];
  }
}

export async function getPendingByRep(
  repId: string,
): Promise<PendingRow[]> {
  if (!hasBrowserDb()) return [];
  try {
    return await localDb.pending.where("repId").equals(repId).toArray();
  } catch {
    return [];
  }
}

/** Edit the form content of a still-`pending` row; identity stays put. */
export async function updatePendingContent(
  id: string,
  patch: VisitFormData,
): Promise<{ ok: boolean; reason?: "missing" | "not-pending" }> {
  if (!hasBrowserDb()) return { ok: false, reason: "missing" };
  const row = await localDb.pending.get(id);
  if (!row) return { ok: false, reason: "missing" };
  if (row.status !== "pending") return { ok: false, reason: "not-pending" };
  await localDb.pending.update(id, {
    priority: patch.priority,
    contact: patch.contact,
    purchasing: patch.purchasing,
    decisionMaking: patch.decisionMaking,
    marketing: patch.marketing,
    notes: patch.notes,
  });
  return { ok: true };
}

export async function setPendingStatus(
  id: string,
  status: PendingStatus,
  extra: Partial<Pick<PendingRow, "lastError" | "retryCount">> = {},
): Promise<void> {
  if (!hasBrowserDb()) return;
  await localDb.pending.update(id, {
    status,
    lastAttemptAt: new Date().toISOString(),
    ...extra,
  });
}

export async function deletePending(id: string): Promise<void> {
  if (!hasBrowserDb()) return;
  await localDb.pending.delete(id);
}

// --- photos (offline write-ahead queue for Vercel Blob uploads) --------
// Mirrors the pending-submissions lifecycle: capture writes a row
// `status: 'pending'` with the compressed Blob attached; the sync
// engine flips it to `uploading`, calls @vercel/blob/client `upload()`,
// then deletes the local row on success (the server is canonical and
// the UI re-reads via /api/photos/[id]/file proxy).
//
// `submissionId` is the only linkage — a photo can target a still-pending
// submission row OR an already-synced Postgres submission. The two-phase
// drain (Checkpoint E) skips photos whose parent submission hasn't
// synced yet so we never try to attach a photo to a row the server
// doesn't know about.

export async function enqueuePhoto(
  photo: Omit<
    LocalPhotoRow,
    "status" | "schemaVersion" | "createdAtLocal" | "retryCount"
  >,
): Promise<LocalPhotoRow> {
  if (!hasBrowserDb()) {
    throw new Error("Local DB unavailable (server context).");
  }
  const row: LocalPhotoRow = {
    ...photo,
    status: "pending",
    schemaVersion: PHOTOS_SCHEMA_VERSION,
    createdAtLocal: new Date().toISOString(),
    retryCount: 0,
  };
  await localDb.photos.put(row);
  return row;
}

export async function getLocalPhoto(
  id: string,
): Promise<LocalPhotoRow | null> {
  if (!hasBrowserDb()) return null;
  try {
    return (await localDb.photos.get(id)) ?? null;
  } catch {
    return null;
  }
}

export async function getPhotosBySubmission(
  submissionId: string,
): Promise<LocalPhotoRow[]> {
  if (!hasBrowserDb()) return [];
  try {
    return await localDb.photos
      .where("submissionId")
      .equals(submissionId)
      .toArray();
  } catch {
    return [];
  }
}

export async function getAllPendingPhotos(): Promise<LocalPhotoRow[]> {
  if (!hasBrowserDb()) return [];
  try {
    return await localDb.photos
      .where("status")
      .anyOf("pending", "failed")
      .toArray();
  } catch {
    return [];
  }
}

export async function setPhotoStatus(
  id: string,
  status: LocalPhotoStatus,
  extra: Partial<
    Pick<LocalPhotoRow, "lastError" | "retryCount">
  > = {},
): Promise<void> {
  if (!hasBrowserDb()) return;
  await localDb.photos.update(id, {
    status,
    lastAttemptAt: new Date().toISOString(),
    ...extra,
  });
}

/** Update a not-yet-uploaded photo's caption. Captions on uploaded
 *  photos are out of scope for Cycle 13 (Q5 deferred). */
export async function updateLocalPhotoCaption(
  id: string,
  caption: string,
): Promise<{ ok: boolean; reason?: "missing" | "uploaded" }> {
  if (!hasBrowserDb()) return { ok: false, reason: "missing" };
  const row = await localDb.photos.get(id);
  if (!row) return { ok: false, reason: "missing" };
  if (row.status === "uploaded") return { ok: false, reason: "uploaded" };
  await localDb.photos.update(id, { caption });
  return { ok: true };
}

export async function deleteLocalPhoto(id: string): Promise<void> {
  if (!hasBrowserDb()) return;
  await localDb.photos.delete(id);
}

