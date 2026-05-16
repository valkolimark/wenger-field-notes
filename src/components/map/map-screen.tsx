"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { schools as ALL_SCHOOLS, type School } from "@/lib/schools";
import { SearchFilter, type TierFilter } from "./search-filter";
import { SchoolPreview } from "./school-preview";

// Leaflet touches `window`; load the map client-side only.
const SchoolMap = dynamic(() => import("./school-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-brand-navy/5">
      <p className="text-sm text-brand-navy/55">Loading map…</p>
    </div>
  ),
});

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
    // Full-bleed layer sized to the gap between the Cycle 2 fixed header
    // and tab bar (mirrors their dimensions; no Cycle 2 files modified).
    <div className="fixed inset-x-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] top-[calc(3.5rem_+_env(safe-area-inset-top))] z-0 flex flex-col md:bottom-0 md:top-[calc(7rem_+_env(safe-area-inset-top))]">
      <SearchFilter
        query={query}
        onQueryChange={setQuery}
        tier={tier}
        onTierChange={setTier}
        shown={filtered.length}
        total={ALL_SCHOOLS.length}
      />

      <div className="relative flex-1">
        <div className="absolute inset-0">
          <SchoolMap schools={filtered} onSelect={setSelected} />
        </div>

        {selected && (
          <SchoolPreview
            school={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}
