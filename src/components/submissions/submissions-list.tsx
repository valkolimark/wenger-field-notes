"use client";

import { useState } from "react";
import Link from "next/link";
import { Map as MapIcon, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { schools } from "@/lib/schools";
import { formatVisitDate } from "@/lib/submissions";
import { deletePending } from "@/lib/db/local";
import { Button, buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { RowsSkeleton } from "@/components/ui/skeleton";
import { useSubmissions } from "./use-submissions";
import { SyncStatusStrip } from "@/components/sync/sync-status-strip";

// Cycle 14: location is now a single human-readable string (Brooke's
// May-2026 planning sheet collapsed address+city). Take the first
// line as the compact list-row hint.
const LOCATION_BY_ID = new Map(
  schools.map((s) => [s.id, s.location.split("\n")[0]?.trim() ?? ""]),
);

function priorityShort(visitPriority: string): string {
  return visitPriority.split("—")[0]?.trim() || visitPriority || "—";
}

export function SubmissionsList() {
  const { data: session } = useSession();
  const { success, error: toastError, confirm } = useToast();
  const { submissions, loading, error, refresh } = useSubmissions();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(sid: string, isPending: boolean) {
    const ok = await confirm({
      title: "Delete this visit?",
      body: isPending
        ? "This pending submission hasn't synced yet. Deleting removes it from this device — the server never sees it."
        : "This permanently removes the submission. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok || deletingId) return;
    setDeletingId(sid);
    try {
      if (isPending) {
        // Pending rows never reached the server; purge locally and the
        // useLiveQuery merge removes the row from the list immediately.
        await deletePending(sid);
      } else {
        const res = await fetch(`/api/submissions/${sid}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      success("Visit deleted");
      await refresh();
    } catch {
      toastError("Couldn't delete this visit — please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  // Cycle 6: /submissions is the rep-facing tab. The API returns all rows
  // for admins (for Cycle 7's /admin), so here we still show each user
  // only their own — the admin "see all" view ships in Cycle 7.
  const repId = session?.user?.repId;
  const visible =
    session?.user?.role === "admin" && repId
      ? submissions.filter((s) => s.repId === repId)
      : submissions;

  return (
    <section>
      <h1 className="text-3xl text-brand-navy">My Submissions</h1>

      <SyncStatusStrip />

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => refresh()}
            className="shrink-0 font-semibold text-red-700 underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <RowsSkeleton rows={4} />
      ) : visible.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <p className="max-w-xs text-sm leading-relaxed text-brand-navy/60">
            You haven&apos;t logged a visit yet. Find a school on the Map
            and tap &ldquo;Start visit&rdquo; to begin.
          </p>
          <Link
            href="/map"
            className={`${buttonClass("primary")} mt-5`}
          >
            <MapIcon size={16} aria-hidden />
            Go to map
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {visible.map((s) => (
            <li
              key={s.id}
              className="overflow-hidden rounded-2xl border border-black/8 bg-white transition-colors hover:border-brand-navy/25"
            >
              <Link
                href={`/submissions/${s.id}`}
                className="flex items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg text-brand-navy">
                      {s.schoolName}
                    </h2>
                    <span className="shrink-0 rounded-full bg-brand-navy/8 px-2 py-0.5 text-[11px] font-medium text-brand-navy">
                      {priorityShort(s.priority.visitPriority)}
                    </span>
                    {s.isPending && (
                      <span
                        className="shrink-0 rounded-full border border-brand-warm/40 bg-brand-warm-soft/60 px-2 py-0.5 text-[11px] font-medium text-brand-warm"
                        title="Saved on this device; waiting to sync"
                      >
                        Pending sync
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-brand-navy/50">
                    {LOCATION_BY_ID.get(s.schoolId)
                      ? `${LOCATION_BY_ID.get(s.schoolId)} · `
                      : ""}
                    {formatVisitDate(s.visitDate)}
                  </p>
                  {s.notes.trim() && (
                    <p className="mt-1.5 truncate text-sm text-brand-navy/65">
                      {s.notes}
                    </p>
                  )}
                </div>
                <ChevronRight
                  size={18}
                  aria-hidden
                  className="shrink-0 text-brand-navy/35"
                />
              </Link>
              <div className="flex gap-1 border-t border-black/8 px-2 py-1.5">
                <Link
                  href={`/submissions/${s.id}/edit`}
                  className={buttonClass("ghost", "md", "flex-1")}
                >
                  <Pencil size={15} aria-hidden />
                  Edit
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => handleDelete(s.id, !!s.isPending)}
                  disabled={deletingId === s.id}
                  className="flex-1 text-danger hover:bg-danger/5 hover:text-danger"
                >
                  <Trash2 size={15} aria-hidden />
                  {deletingId === s.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
