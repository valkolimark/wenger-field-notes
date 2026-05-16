"use client";

import { useSearchParams } from "next/navigation";

export default function PlaceholderContent() {
  const rep = useSearchParams().get("rep");

  return (
    <div className="max-w-sm animate-fade-in">
      <p className="font-display text-2xl italic text-white">
        Hi, {rep ?? "there"}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-white/70">
        Cycle 2 will build the app shell here.
      </p>
    </div>
  );
}
