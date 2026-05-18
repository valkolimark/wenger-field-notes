"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { schools, type School } from "@/lib/schools";
import type { Submission } from "@/lib/submissions";
import { VisitForm } from "@/components/form/visit-form";

type Status = "loading" | "ok" | "notfound" | "forbidden" | "error";

const backLink = (
  <Link
    href="/submissions"
    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy/60 transition-colors hover:text-brand-navy"
  >
    <ArrowLeft size={16} aria-hidden />
    Back to submissions
  </Link>
);

export function EditSubmission({ id }: { id: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [sub, setSub] = useState<Submission | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/submissions/${id}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setStatus("notfound");
        return;
      }
      if (res.status === 403) {
        setStatus("forbidden");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSub((await res.json()) as Submission);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") {
    return (
      <section>
        {backLink}
        <div className="mt-4 animate-fade-in-soft" aria-hidden>
          <div className="h-8 w-2/3 animate-pulse rounded bg-black/8" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-black/8" />
          <div className="mt-5 h-40 animate-pulse rounded-2xl bg-black/[0.06]" />
          <div className="mt-4 h-28 animate-pulse rounded-2xl bg-black/[0.06]" />
          <div className="mt-4 h-28 animate-pulse rounded-2xl bg-black/[0.06]" />
        </div>
      </section>
    );
  }

  if (status === "notfound") {
    return (
      <section>
        {backLink}
        <h1 className="mt-4 text-3xl text-brand-navy">
          Submission not found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-navy/60">
          We couldn&apos;t find this visit. It may have been removed.
        </p>
      </section>
    );
  }

  if (status === "forbidden") {
    return (
      <section>
        {backLink}
        <h1 className="mt-4 text-3xl text-brand-navy">
          You can&apos;t edit this visit
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-navy/60">
          This submission belongs to another rep. You can only edit your
          own visits.
        </p>
      </section>
    );
  }

  if (status === "error" || !sub) {
    return (
      <section>
        {backLink}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>Couldn&apos;t load this visit — please try again.</span>
          <button
            type="button"
            onClick={() => load()}
            className="shrink-0 font-semibold text-red-700 underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  // Submissions always reference a static school; fall back to the row's
  // own school fields defensively if the static list ever changes.
  const school: School =
    schools.find((s) => s.id === sub.schoolId) ??
    ({
      id: sub.schoolId,
      name: sub.schoolName,
      address: "",
      city: "",
    } as unknown as School);

  return <VisitForm school={school} editSubmission={sub} />;
}
