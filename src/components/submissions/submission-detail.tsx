"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { schools } from "@/lib/schools";
import {
  type Submission,
  getSubmission,
  formatVisitDate,
} from "@/lib/submissions";
import { CollapsibleSection } from "@/components/form/collapsible-section";

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

export function SubmissionDetail({ id }: { id: string }) {
  // localStorage is browser-only; resolve after mount.
  const [state, setState] = useState<{
    sub: Submission | null;
    ready: boolean;
  }>({ sub: null, ready: false });

  useEffect(() => {
    setState({ sub: getSubmission(id) ?? null, ready: true });
  }, [id]);

  const backLink = (
    <Link
      href="/submissions"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy/60 transition-colors hover:text-brand-navy"
    >
      <ArrowLeft size={16} aria-hidden />
      Back to submissions
    </Link>
  );

  if (!state.ready) {
    return (
      <section>
        {backLink}
        <p className="mt-6 text-sm text-brand-navy/45">Loading…</p>
      </section>
    );
  }

  if (!state.sub) {
    return (
      <section>
        {backLink}
        <h1 className="mt-4 font-display text-3xl text-brand-navy">
          Submission not found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-navy/60">
          This visit isn&apos;t saved on this device. Submissions are
          local-only until Cycle 5.
        </p>
      </section>
    );
  }

  const s = state.sub;
  const school = SCHOOL_BY_ID.get(s.schoolId);

  return (
    <div className="pb-10">
      {backLink}

      <header className="mt-4">
        <h1 className="font-display text-3xl leading-tight text-brand-navy">
          {s.schoolName}
        </h1>
        <p className="mt-1 text-sm text-brand-navy/55">
          {school ? `${school.address}, ${school.city} · ` : ""}
          {formatVisitDate(s.visitDate)} · Logged by {s.repName}
        </p>
      </header>

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

        <CollapsibleSection title="Notes">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-navy/85">
            {s.notes.trim() || DASH}
          </p>
        </CollapsibleSection>
      </div>
    </div>
  );
}
