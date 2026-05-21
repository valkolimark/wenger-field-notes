"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { schools as ALL_SCHOOLS, type School } from "@/lib/schools";
import { SearchFilter, type TierFilter } from "./search-filter";
import { SchoolPreview } from "./school-preview";
import { SchoolList } from "./school-list";

// Cycle 14: Brooke's May-2026 dataset replaces the prior 47 schools
// with 39 schools across 4 tiers and DROPS the lat/lng fields. Until a
// geocoding cycle adds coordinates, the Leaflet map can't pin anything,
// so the /map screen is a tier-grouped LIST. The screen keeps the same
// search + tier-pill chrome; tapping a school still opens the existing
// SchoolPreview side sheet with the Start visit CTA. The route is
// intentionally named /map so the SW prefetch + tab bar wiring don't
// need to move; the map view returns when coordinates exist.

export function MapScreen() {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<TierFilter>("all");
  const [selected, setSelected] = useState<School | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_SCHOOLS.filter(
      (s) =>
        (tier === "all" || s.tier === tier) &&
        (q === "" || s.name.toLowerCase().includes(q)),
    );
  }, [query, tier]);

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] top-[calc(3.5rem_+_env(safe-area-inset-top))] z-0 flex flex-col md:bottom-0 md:top-[calc(7rem_+_env(safe-area-inset-top))]">
      <SearchFilter
        query={query}
        onQueryChange={setQuery}
        tier={tier}
        onTierChange={setTier}
        shown={filtered.length}
        total={ALL_SCHOOLS.length}
      />

      {/* Scrolling region: banner + tier list. Kept separate from the
          preview overlay below so the overlay always pins to the
          visible viewport, not the bottom of long scroll content. */}
      <div className="relative flex-1 overflow-y-auto bg-brand-navy/[0.02]">
        <div className="border-b border-brand-navy/10 bg-white/70 px-4 py-2 text-xs leading-relaxed text-brand-navy/70">
          <span className="inline-flex items-start gap-1.5">
            <Info
              size={14}
              aria-hidden
              className="mt-px shrink-0 text-brand-navy/55"
            />
            Map coordinates are coming in a future update. For now, pick a
            school from the list to start a visit.
          </span>
        </div>
        <SchoolList
          schools={filtered}
          totalCount={ALL_SCHOOLS.length}
          onSelect={setSelected}
        />
      </div>

      {selected && (
        <SchoolPreview
          school={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
