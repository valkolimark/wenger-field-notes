"use client";

import Link from "next/link";
import { Map as MapIcon, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { schools } from "@/lib/schools";
import { formatVisitDate } from "@/lib/submissions";
import { buttonClass } from "@/components/ui/button";
import { RowsSkeleton } from "@/components/ui/skeleton";
import { useSubmissions } from "./use-submissions";

const CITY_BY_ID = new Map(schools.map((s) => [s.id, s.city]));

function priorityShort(visitPriority: string): string {
  return visitPriority.split("—")[0]?.trim() || visitPriority || "—";
}

export function SubmissionsList() {
  const { data: session } = useSession();
  const { submissions, loading, error, refresh } = useSubmissions();

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
            <li key={s.id}>
              <Link
                href={`/submissions/${s.id}`}
                className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white p-4 transition-colors hover:border-brand-navy/25"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg text-brand-navy">
                      {s.schoolName}
                    </h2>
                    <span className="shrink-0 rounded-full bg-brand-navy/8 px-2 py-0.5 text-[11px] font-medium text-brand-navy">
                      {priorityShort(s.priority.visitPriority)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-brand-navy/50">
                    {CITY_BY_ID.get(s.schoolId)
                      ? `${CITY_BY_ID.get(s.schoolId)} · `
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
