"use client";

import Link from "next/link";
import { Map as MapIcon, ChevronRight } from "lucide-react";
import { useRep } from "@/components/shell/rep-context";
import { schools } from "@/lib/schools";
import { repIdFromName, formatVisitDate } from "@/lib/submissions";
import { useSubmissions } from "./use-submissions";

const CITY_BY_ID = new Map(schools.map((s) => [s.id, s.city]));

function priorityShort(visitPriority: string): string {
  return visitPriority.split("—")[0]?.trim() || visitPriority || "—";
}

export function SubmissionsList() {
  const { rep } = useRep();
  const repId = rep ? repIdFromName(rep) : "";
  const { submissions, loading } = useSubmissions(repId);

  return (
    <section>
      <h1 className="font-display text-3xl text-brand-navy">My Submissions</h1>

      {loading ? (
        <p className="mt-6 text-sm text-brand-navy/45">Loading…</p>
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
