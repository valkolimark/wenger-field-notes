"use client";

// Cycle 14: tier-grouped school list. Used as the /map screen content
// while the new May-2026 dataset has no lat/lng coordinates (the
// pre-Cycle-13 Leaflet map can't pin them). Once a geocoding cycle
// adds coords this becomes a sibling view alongside the map; for now
// it's the only entry point reps have to "start a visit" — so it must
// surface ALL schools, grouped by tier in the canonical order.

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { SCHOOL_TIERS, type School } from "@/lib/schools";

export function SchoolList({
  schools,
  totalCount,
  onSelect,
}: {
  /** Already filtered by the screen-level search + tier pills. */
  schools: School[];
  /** Unfiltered total — used to phrase the empty state. */
  totalCount: number;
  onSelect: (school: School) => void;
}) {
  // Group by tier in the canonical SCHOOL_TIERS order, dropping any
  // tier with no schools after the filter. Schools inside a tier are
  // alphabetized by name (the dataset is roughly priority-ordered, but
  // alphabetical reads cleaner in a list).
  const grouped = useMemo(() => {
    const byTier = new Map<string, School[]>();
    for (const s of schools) {
      const bucket = byTier.get(s.tier) ?? [];
      bucket.push(s);
      byTier.set(s.tier, bucket);
    }
    return SCHOOL_TIERS.filter((t) => (byTier.get(t)?.length ?? 0) > 0).map(
      (t) => ({
        tier: t,
        rows: (byTier.get(t) ?? []).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }),
    );
  }, [schools]);

  if (schools.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-brand-navy/55">
        {totalCount === 0
          ? "No schools yet."
          : "No schools match this filter — clear the search or pick a different tier."}
      </p>
    );
  }

  return (
    <div className="px-4 py-3">
      {grouped.map(({ tier, rows }) => (
        <section key={tier} className="mb-5 last:mb-0">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-navy/55">
            {tier}{" "}
            <span className="ml-1 font-medium text-brand-navy/40">
              ({rows.length})
            </span>
          </h2>
          <ul className="space-y-2">
            {rows.map((school) => (
              <li key={school.id}>
                <button
                  type="button"
                  onClick={() => onSelect(school)}
                  className="flex w-full items-center gap-3 rounded-xl border border-black/8 bg-white px-3 py-3 text-left transition-colors duration-150 ease-out hover:border-brand-navy/30 hover:bg-brand-navy/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-brand-navy">
                      {school.name}
                    </p>
                    {school.location && (
                      <p className="mt-0.5 truncate text-xs text-brand-navy/55">
                        {school.location.split("\n")[0]}
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    size={18}
                    aria-hidden
                    className="shrink-0 text-brand-navy/40"
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
