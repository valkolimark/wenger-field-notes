"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { type School, TIER_LABELS } from "@/lib/schools";

export function SchoolPreview({
  school,
  onClose,
}: {
  school: School;
  onClose: () => void;
}) {
  // Esc closes (accessibility / desktop).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Transparent catcher — tap the map outside the card to close.
          Kept transparent so the map stays visible (spatial context). */}
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 z-[900]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={school.name}
        className="absolute inset-x-0 bottom-0 z-[1000] flex max-h-[78%] flex-col overflow-hidden rounded-t-2xl border border-black/5 bg-white shadow-2xl animate-sheet-up md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-96 md:rounded-l-2xl md:rounded-tr-none md:border-l md:animate-sheet-in"
      >
        <div className="flex justify-center pt-2 md:hidden">
          <span className="h-1.5 w-10 rounded-full bg-black/15" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-3 md:pt-6">
          <h2 className="font-display text-2xl leading-tight text-brand-navy">
            {school.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-brand-navy/50 transition-colors hover:bg-black/5 hover:text-brand-navy"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <span className="inline-block rounded-full bg-brand-navy/8 px-2.5 py-1 text-[11px] font-medium text-brand-navy">
            {TIER_LABELS[school.tier]}
          </span>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-navy/45">
                Address
              </dt>
              <dd className="mt-0.5 text-brand-navy/80">
                {school.address}
                <br />
                {school.city}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-navy/45">
                Enrollment
              </dt>
              <dd className="mt-0.5 text-brand-navy/80">{school.enrollment}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-brand-navy/45">
                Project activity
              </dt>
              <dd className="mt-0.5 leading-relaxed text-brand-navy/80">
                {school.projectActivity}
              </dd>
            </div>
          </dl>
        </div>

        <div className="border-t border-black/5 p-4">
          <Link
            href={`/form/${school.id}`}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-navy-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy"
          >
            Start visit
          </Link>
        </div>
      </div>
    </>
  );
}
