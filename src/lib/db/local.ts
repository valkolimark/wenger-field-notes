// Cycle 12: client-side IndexedDB via Dexie. Two stores back the
// offline-first flow:
//   drafts            — in-progress forms (write-ahead of the visit form)
//   pending_submissions — finished visits queued for sync to Neon
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

class LocalDB extends Dexie {
  drafts!: Table<DraftRow, string>;
  pending!: Table<PendingRow, string>;

  constructor() {
    super("wenger-fieldnotes");
    this.version(1).stores({
      // & = unique primary; trailing fields = secondary indexes
      drafts: "&key, repId, schoolId, updatedAt",
      pending: "&id, repId, status, createdAtLocal",
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

