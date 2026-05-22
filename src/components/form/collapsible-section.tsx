"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  // Cycle 18 followup: navy header bar + bold white text so the
  // form's section dividers are obvious at a glance (the redesign
  // stacked several collapsibles vertically and the prior light-on-
  // white header didn't read as a separator on mobile). `rounded-t-2xl`
  // keeps the navy strip flush with the section card's corners; the
  // panel below stays white. Same component, same sections also used
  // by submission-detail — they get the same treatment for visual
  // consistency between the form (writing) and the detail (reading).
  return (
    <section className="overflow-hidden rounded-2xl border border-black/8 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 bg-brand-navy px-4 py-3 text-left transition-colors duration-200 hover:bg-brand-navy-light"
      >
        <span className="text-lg font-bold text-white">{title}</span>
        <ChevronDown
          size={20}
          aria-hidden
          className={`shrink-0 text-white/80 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* grid-rows 0fr -> 1fr gives a smooth height transition with no JS measuring */}
      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-5 px-4 py-5">{children}</div>
        </div>
      </div>
    </section>
  );
}
