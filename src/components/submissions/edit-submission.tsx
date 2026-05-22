"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { schools, type School } from "@/lib/schools";
import type { Submission } from "@/lib/submissions";
import { getPending } from "@/lib/db/local";
import { useToast } from "@/components/ui/toast";
import { VisitForm } from "@/components/form/visit-form";
import {
  readUrlSegment,
  SUBMISSION_ID_PATH,
} from "@/lib/url-id";

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

export function EditSubmission({ id: idFromProps }: { id: string }) {
  // Cycle 17: prefer the URL bar over the server-passed prop.
  // Background: the Cycle 16 /submissions/* prefix-fallback in the SW
  // serves cached /submissions/__prefetch__/edit HTML for any
  // /submissions/<realId>/edit URL offline. The server-rendered HTML
  // baked `id="__prefetch__"` into the EditSubmission prop chain, so
  // the hydrated client component would try to load "__prefetch__"
  // (not the rep's real submission). The URL bar is the source of
  // truth for what the rep tapped.
  const id = readUrlSegment(SUBMISSION_ID_PATH, idFromProps);

  // Cycle 12: when the save handler hits a "row syncing/synced" race it
  // redirects here with `?just-synced=1` — we then bypass Dexie and
  // load from the server in non-pending mode.
  const params = useSearchParams();
  const forceServer = params.get("just-synced") === "1";
  const { success } = useToast();

  const [status, setStatus] = useState<Status>("loading");
  const [sub, setSub] = useState<Submission | null>(null);
  const [isPendingEdit, setIsPendingEdit] = useState(false);

  // One-shot notice after a race redirect.
  useEffect(() => {
    if (forceServer) success("This visit just synced — opening online edit");
  }, [forceServer, success]);

  const load = useCallback(async () => {
    setStatus("loading");

    if (!forceServer) {
      const local = await getPending(id);
      if (local && local.status === "pending") {
        // PendingRow is a Submission superset; the extra fields are
        // ignored by VisitForm but kept on the object.
        setSub(local);
        setIsPendingEdit(true);
        setStatus("ok");
        return;
      }
    }

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
      setIsPendingEdit(false);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id, forceServer]);

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

  // Cycle 14: schools may be removed from the dataset between when a
  // submission was logged and when it's edited (Brooke's May 2026 swap
  // dropped ~8 entries). Fall back to a minimal stub so edit still works
  // even if the schoolId no longer matches any current row.
  // Cycle 14: schools may be removed from the dataset between when a
  // submission was logged and when it's edited (Brooke's May 2026 swap
  // dropped ~8 entries). Fall back to a minimal stub so edit still works
  // even if the schoolId no longer matches any current row. Cycle 15:
  // lat/lng default to LA-area centroid (the rep won't see the map on
  // the edit page, so the values don't render — they just satisfy the
  // type).
  const school: School =
    schools.find((s) => s.id === sub.schoolId) ?? {
      id: sub.schoolId,
      name: sub.schoolName,
      tier: "",
      location: "",
      enrollment: "",
      projectActivity: "",
      contacts: [],
      notes: "",
      lat: 34.05,
      lng: -118.25,
    };

  return (
    <VisitForm
      school={school}
      editSubmission={sub}
      isPendingEdit={isPendingEdit}
    />
  );
}
