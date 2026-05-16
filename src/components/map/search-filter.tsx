"use client";

import { Search, X } from "lucide-react";
import type { Tier } from "@/lib/schools";

export type TierFilter = Tier | "all";

const TIER_PILLS: { key: TierFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tier1", label: "Tier 1" },
  { key: "core", label: "Core" },
  { key: "catholic", label: "Catholic" },
  { key: "expanded", label: "Expanded" },
];

export function SearchFilter({
  query,
  onQueryChange,
  tier,
  onTierChange,
  shown,
  total,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  tier: TierFilter;
  onTierChange: (t: TierFilter) => void;
  shown: number;
  total: number;
}) {
  return (
    <div className="shrink-0 border-b border-black/5 bg-white/95 px-4 py-3 backdrop-blur-md">
      <div className="relative">
        <Search
          size={18}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-navy/40"
        />
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search schools by name"
          aria-label="Search schools by name"
          className="h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-10 text-sm text-brand-navy outline-none placeholder:text-brand-navy/40 focus-visible:border-brand-navy/40 focus-visible:ring-2 focus-visible:ring-brand-navy/15"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-brand-navy/50 transition-colors hover:bg-black/5 hover:text-brand-navy"
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="-mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-0.5">
          {TIER_PILLS.map(({ key, label }) => {
            const active = tier === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTierChange(key)}
                aria-pressed={active}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                  active
                    ? "border-brand-navy bg-brand-navy text-white"
                    : "border-black/10 bg-white text-brand-navy/70 hover:border-brand-navy/30 hover:text-brand-navy"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-xs text-brand-navy/55" aria-live="polite">
        Showing {shown} of {total} schools
      </p>
    </div>
  );
}
