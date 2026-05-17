"use client";

import Link from "next/link";
import { Map as MapIcon, ChevronRight } from "lucide-react";
import { schools } from "@/lib/schools";
import { formatVisitDate } from "@/lib/submissions";
import { useSubmissions } from "./use-submissions";

const CITY_BY_ID = new Map(schools.map((s) => [s.id, s.city]));

function priorityShort(visitPriority: string): string {
  return visitPriority.split("—")[0]?.trim() || visitPriority || "—";
}

function SkeletonCards() {
  return (
    <div className="mt-5 animate-fade-in-soft space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[88px] rounded-2xl border border-black/8 bg-white p-4"
        >
          <div className="h-4 w-1/2 animate-pulse rounded bg-black/8" />
          <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-black/8" />
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-black/8" />
        </div>
      ))}
    </div>
  );
}

export function SubmissionsList() {
  const { submissions, loading, error, refresh } = useSubmissions();

  return (
    <section>
      <h1 className="font-display text-3xl text-brand-navy">My Submissions</h1>

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
        <SkeletonCards />
      ) : submissions.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <p className="text-sm text-brand-navy/60">
            No visits logged yet — head to the map to log your first.
          </p>
          <Link
            href="/map"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-light"
          >
            <MapIcon size={16} aria-hidden />
            Go to map
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {submissions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/submissions/${s.id}`}
                className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white p-4 transition-colors hover:border-brand-navy/25"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-display text-lg text-brand-navy">
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
