"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { schools } from "@/lib/schools";
import { type Submission, formatVisitDate } from "@/lib/submissions";
import { getPending, deletePending } from "@/lib/db/local";
import { Button, buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CollapsibleSection } from "@/components/form/collapsible-section";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import {
  readUrlSegment,
  SUBMISSION_ID_PATH,
} from "@/lib/url-id";

const DASH = "—";
const SCHOOL_BY_ID = new Map(schools.map((s) => [s.id, s]));

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-brand-navy/45">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm leading-relaxed text-brand-navy/85">
        {value || DASH}
      </dd>
    </div>
  );
}

const list = (arr: string[]) => (arr.length ? arr.join(", ") : DASH);

type Status = "loading" | "ok" | "notfound" | "error";

export function SubmissionDetail({ id: idFromProps }: { id: string }) {
  // Cycle 17: read the URL bar instead of the server-passed prop —
  // when the SW serves a cached /submissions/__prefetch__ HTML for
  // /submissions/<realId> offline (Cycle 16 prefix fallback), the
  // prop would be "__prefetch__" and the detail view would show a
  // "not found" for every real submission. See lib/url-id.ts.
  const id = readUrlSegment(SUBMISSION_ID_PATH, idFromProps);

  const router = useRouter();
  const { success, error: toastError, confirm } = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [sub, setSub] = useState<Submission | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cycle 12: pending rows never reached the server — delete locally,
  // skip the API entirely. Synced rows take the Cycle 10 API path
  // (owner-or-admin re-checked server-side).
  async function handleDelete() {
    const ok = await confirm({
      title: "Delete this visit?",
      body: isPending
        ? "This pending submission hasn't synced yet. Deleting removes it from this device — the server never sees it."
        : "This permanently removes the submission. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok || deleting) return;
    setDeleting(true);
    try {
      if (isPending) {
        await deletePending(id);
      } else {
        const res = await fetch(`/api/submissions/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      success("Visit deleted");
      router.push("/submissions");
    } catch {
      setDeleting(false);
      toastError("Couldn't delete this visit — please try again.");
    }
  }

  const load = useCallback(async () => {
    setStatus("loading");
    // Cycle 12: try the local pending queue first. A pending row never
    // existed on the server, so a 404 from the API would be misleading.
    const local = await getPending(id);
    if (local) {
      setSub(local);
      setIsPending(true);
      setStatus("ok");
      return;
    }
    try {
      const res = await fetch(`/api/submissions/${id}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setStatus("notfound");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSub((await res.json()) as Submission);
      setIsPending(false);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const backLink = (
    <Link
      href="/submissions"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy/60 transition-colors hover:text-brand-navy"
    >
      <ArrowLeft size={16} aria-hidden />
      Back to submissions
    </Link>
  );

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

  if (status === "error" || !sub) {
    return (
      <section>
        {backLink}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>Couldn&apos;t load this submission — please try again.</span>
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

  const s = sub;
  const school = SCHOOL_BY_ID.get(s.schoolId);

  return (
    <div className="pb-10">
      {backLink}

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl leading-tight text-brand-navy">
            {s.schoolName}
          </h1>
          {isPending && (
            <span
              className="rounded-full border border-brand-warm/40 bg-brand-warm-soft/60 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-brand-warm"
              title="Saved on this device; waiting to sync to the server"
            >
              Pending sync
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-brand-navy/55">
          {school?.location ? `${school.location} · ` : ""}
          {formatVisitDate(s.visitDate)} · Logged by {s.repName}
        </p>
      </header>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/submissions/${id}/edit`}
          className={buttonClass("secondary")}
        >
          <Pencil size={16} aria-hidden />
          Edit
        </Link>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 size={16} aria-hidden />
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </div>

      {/* Priority block — read-only, mirrors the form's warm distinction */}
      <div className="mt-5 rounded-2xl border border-brand-warm/30 border-l-4 border-l-brand-warm bg-brand-warm-soft/40 px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-warm">
          Priority
        </p>
        <dl className="mt-4 space-y-4">
          <Row label="Visit priority" value={s.priority.visitPriority} />
          <Row label="Project timing" value={s.priority.projectTiming} />
          <Row
            label="Estimated opportunity size"
            value={s.priority.opportunitySize}
          />
          <Row label="Next action" value={s.priority.nextAction} />
        </dl>
      </div>

      <div className="mt-5 space-y-4">
        <CollapsibleSection title="Contact">
          <dl className="space-y-4">
            <Row label="Primary contact name" value={s.contact.name} />
            <Row label="Title / role" value={s.contact.title} />
            <Row label="Email" value={s.contact.email} />
            <Row label="Phone" value={s.contact.phone} />
            <Row label="Met with today" value={list(s.contact.metWith)} />
            <Row label="Other contact" value={s.contact.otherContact} />
          </dl>
        </CollapsibleSection>

        <CollapsibleSection title="Purchasing">
          <dl className="space-y-4">
            <Row
              label="Decision authority"
              value={s.purchasing.decisionAuthority}
            />
            <Row
              label="Procurement process"
              value={s.purchasing.procurementProcess}
            />
            <Row label="Budget status" value={s.purchasing.budgetStatus} />
          </dl>
        </CollapsibleSection>

        <CollapsibleSection title="Decision-making">
          <dl className="space-y-4">
            <Row
              label="Stakeholders involved"
              value={list(s.decisionMaking.stakeholders)}
            />
            <Row
              label="Competing vendors mentioned"
              value={s.decisionMaking.competingVendors}
            />
            <Row
              label="Decision timeline"
              value={s.decisionMaking.decisionTimeline}
            />
          </dl>
        </CollapsibleSection>

        <CollapsibleSection title="Marketing">
          <dl className="space-y-4">
            <Row
              label="How did they hear about Wenger?"
              value={list(s.marketing.heardAbout)}
            />
            <Row
              label="Materials left behind"
              value={list(s.marketing.materialsLeft)}
            />
            <Row
              label="Follow-up materials requested"
              value={s.marketing.followUpRequested}
            />
          </dl>
        </CollapsibleSection>

        <CollapsibleSection title="Photos">
          <PhotoGallery
            submissionId={s.id}
            isPending={isPending}
            canDelete
          />
        </CollapsibleSection>

        <CollapsibleSection title="Notes">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-navy/85">
            {s.notes.trim() || DASH}
          </p>
        </CollapsibleSection>

        {/* Cycle 14: school-static context (people + historical notes from
            Brooke's planning sheet). Collapsed by default so it doesn't
            push the rep's own visit data offscreen. */}
        {school && school.contacts.length > 0 && (
          <CollapsibleSection title="School contacts" defaultOpen={false}>
            <ul className="space-y-2">
              {school.contacts.map((c, i) => (
                <li
                  key={`${c.role}-${c.name}-${i}`}
                  className="rounded-xl border border-black/8 bg-white px-3 py-2"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-navy/45">
                    {c.role}
                  </p>
                  <p className="mt-0.5 text-sm text-brand-navy/85">{c.name}</p>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {school && school.notes.trim() && (
          <CollapsibleSection title="Background" defaultOpen={false}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-navy/85">
              {school.notes.trim()}
            </p>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
