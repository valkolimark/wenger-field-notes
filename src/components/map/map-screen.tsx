"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Map as MapIcon,
  List as ListIcon,
  Plus,
} from "lucide-react";
import { schools as ALL_SCHOOLS, type School } from "@/lib/schools";
import { SearchFilter, type TierFilter } from "./search-filter";
import { SchoolPreview } from "./school-preview";
import { SchoolList } from "./school-list";

// Cycle 15: map is back (Cycle 14 had stripped it because the new
// dataset had no coordinates). Default view is the Leaflet pin map;
// a Map/List toggle in the toolbar lets reps switch to the
// tier-grouped list for scanning by name. Preview overlay sits
// outside the scrolling/list region so it always pins to the
// visible viewport, not the bottom of long scroll content.

// Leaflet touches `window`; load the map client-side only.
const SchoolMap = dynamic(() => import("./school-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-brand-navy/5">
      <p className="text-sm text-brand-navy/55">Loading map…</p>
    </div>
  ),
});

type View = "map" | "list";

export function MapScreen() {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<TierFilter>("all");
  const [selected, setSelected] = useState<School | null>(null);
  const [view, setView] = useState<View>("map");

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

      <ViewToggle view={view} onChange={setView} />

      <div className="relative flex-1">
        {view === "map" ? (
          <div className="absolute inset-0">
            <SchoolMap schools={filtered} onSelect={setSelected} />
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto bg-brand-navy/[0.02]">
            <SchoolList
              schools={filtered}
              totalCount={ALL_SCHOOLS.length}
              onSelect={setSelected}
            />
          </div>
        )}
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

function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Map or list view"
      className="flex shrink-0 items-center gap-1 border-b border-black/5 bg-white/95 px-4 py-2 backdrop-blur-md"
    >
      <ToggleButton
        active={view === "map"}
        onClick={() => onChange("map")}
        icon={<MapIcon size={14} aria-hidden />}
        label="Map"
      />
      <ToggleButton
        active={view === "list"}
        onClick={() => onChange("list")}
        icon={<ListIcon size={14} aria-hidden />}
        label="List"
      />
      {/* Cycle 19: entry point for off-list ("ad-hoc") visits. Reuses
          the existing /form/[schoolId] route — "custom" is just a
          value of the dynamic segment. Discreet styling: it's
          secondary to Map/List but tappable with a thumb. */}
      <Link
        href="/form/custom"
        className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-dashed border-brand-navy/30 px-3 py-1 text-xs font-medium text-brand-navy/70 transition-colors duration-200 hover:border-brand-navy/60 hover:text-brand-navy"
      >
        <Plus size={14} aria-hidden />
        School not listed
      </Link>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200 ${
        active
          ? "border-brand-navy bg-brand-navy text-white"
          : "border-black/10 bg-white text-brand-navy/70 hover:border-brand-navy/30 hover:text-brand-navy"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
