"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import type { School } from "@/lib/schools";
import { useSession } from "next-auth/react";
import { CollapsibleSection } from "./collapsible-section";
import { RadioGroup, CheckboxGroup, TextField, TextArea } from "./fields";
import {
  type VisitFormData,
  type Submission,
  createEmptyForm,
  newSubmissionId,
  loadDraft,
  saveDraft,
  clearDraft,
  formatRelative,
  VISIT_PRIORITY_OPTIONS,
  PROJECT_TIMING_OPTIONS,
  OPPORTUNITY_SIZE_OPTIONS,
  MET_WITH_OPTIONS,
  DECISION_AUTHORITY_OPTIONS,
  PROCUREMENT_OPTIONS,
  BUDGET_STATUS_OPTIONS,
  STAKEHOLDER_OPTIONS,
  DECISION_TIMELINE_OPTIONS,
  HEARD_ABOUT_OPTIONS,
  MATERIALS_LEFT_OPTIONS,
} from "@/lib/submissions";

type Action =
  | { type: "priority"; patch: Partial<VisitFormData["priority"]> }
  | { type: "contact"; patch: Partial<VisitFormData["contact"]> }
  | { type: "purchasing"; patch: Partial<VisitFormData["purchasing"]> }
  | { type: "decisionMaking"; patch: Partial<VisitFormData["decisionMaking"]> }
  | { type: "marketing"; patch: Partial<VisitFormData["marketing"]> }
  | { type: "notes"; value: string }
  | { type: "load"; data: VisitFormData };

function reducer(state: VisitFormData, action: Action): VisitFormData {
  switch (action.type) {
    case "priority":
      return { ...state, priority: { ...state.priority, ...action.patch } };
    case "contact":
      return { ...state, contact: { ...state.contact, ...action.patch } };
    case "purchasing":
      return {
        ...state,
        purchasing: { ...state.purchasing, ...action.patch },
      };
    case "decisionMaking":
      return {
        ...state,
        decisionMaking: { ...state.decisionMaking, ...action.patch },
      };
    case "marketing":
      return {
        ...state,
        marketing: { ...state.marketing, ...action.patch },
      };
    case "notes":
      return { ...state, notes: action.value };
    case "load":
      return action.data;
  }
}

export function VisitForm({ school }: { school: School }) {
  const router = useRouter();
  const { data: session } = useSession();
  const repId = session?.user?.repId ?? "";
  const repName = session?.user?.name ?? session?.user?.email ?? "";

  const [form, dispatch] = useReducer(reducer, undefined, createEmptyForm);
  const [priorityError, setPriorityError] = useState<string>("");
  const [draftAt, setDraftAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const priorityRef = useRef<HTMLDivElement>(null);
  const baselineRef = useRef<string>(JSON.stringify(createEmptyForm()));
  const restoredRef = useRef(false);

  // Restore an existing draft once (per rep + school).
  useEffect(() => {
    if (restoredRef.current || !repId) return;
    restoredRef.current = true;
    const draft = loadDraft(repId, school.id);
    if (draft) {
      dispatch({ type: "load", data: draft.data });
      baselineRef.current = JSON.stringify(draft.data);
      setDraftAt(draft.updatedAt);
    }
  }, [repId, school.id]);

  const isDirty = JSON.stringify(form) !== baselineRef.current;

  // Debounced draft autosave.
  useEffect(() => {
    if (!repId || !isDirty || saved) return;
    const t = setTimeout(() => saveDraft(repId, school.id, form), 400);
    return () => clearTimeout(t);
  }, [form, repId, school.id, isDirty, saved]);

  function discardDraft() {
    clearDraft(repId, school.id);
    const empty = createEmptyForm();
    dispatch({ type: "load", data: empty });
    baselineRef.current = JSON.stringify(empty);
    setDraftAt(null);
  }

  function handleBack() {
    if (isDirty && !window.confirm("You have unsaved changes — discard?")) {
      return;
    }
    router.push("/map");
  }

  function handleMetWith(next: string[]) {
    dispatch({
      type: "contact",
      patch: next.includes("Other")
        ? { metWith: next }
        : { metWith: next, otherContact: "" },
    });
  }

  async function save(then: "list" | "map") {
    if (!form.priority.visitPriority) {
      setPriorityError("Please set visit priority");
      priorityRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    if (!repId || saving) return;
    setSaveError(null);
    setSaving(true);

    const submission: Submission = {
      id: newSubmissionId(school.id),
      schoolId: school.id,
      schoolName: school.name,
      repId,
      repName,
      visitDate: new Date().toISOString(),
      ...form,
    };

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // Keep the form filled; the rep can retry.
      setSaving(false);
      setSaveError("Couldn't save — check your connection and try again.");
      return;
    }

    // Only now is it safe to drop the local draft.
    clearDraft(repId, school.id);
    setSaved(true);
    setTimeout(
      () => router.push(then === "map" ? "/map" : "/submissions"),
      then === "map" ? 900 : 1600,
    );
  }

  return (
    <div className="pb-44 md:pb-40">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy/60 transition-colors hover:text-brand-navy"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to map
      </button>

      <header className="mt-4">
        <h1 className="font-display text-3xl leading-tight text-brand-navy">
          {school.name}
        </h1>
        <p className="mt-1 text-sm text-brand-navy/55">
          {school.address}, {school.city}
        </p>
      </header>

      {draftAt && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-navy/5 px-3 py-2 text-xs text-brand-navy/70">
          <span>Draft restored — last edited {formatRelative(draftAt)}</span>
          <button
            type="button"
            onClick={discardDraft}
            className="font-medium text-brand-navy underline underline-offset-2 hover:no-underline"
          >
            Discard draft
          </button>
        </div>
      )}

      {/* --- Priority block (warm-accented, restrained) --- */}
      <div
        ref={priorityRef}
        className="mt-5 scroll-mt-24 rounded-2xl border border-brand-warm/30 border-l-4 border-l-brand-warm bg-brand-warm-soft/40 px-4 py-5"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-warm">
          Priority
        </p>
        <div className="mt-4 space-y-5">
          <RadioGroup
            label="Visit priority"
            name="visitPriority"
            required
            options={VISIT_PRIORITY_OPTIONS}
            value={form.priority.visitPriority}
            onChange={(v) => {
              setPriorityError("");
              dispatch({ type: "priority", patch: { visitPriority: v } });
            }}
            error={priorityError}
          />
          <RadioGroup
            label="Project timing"
            name="projectTiming"
            options={PROJECT_TIMING_OPTIONS}
            value={form.priority.projectTiming}
            onChange={(v) =>
              dispatch({ type: "priority", patch: { projectTiming: v } })
            }
          />
          <RadioGroup
            label="Estimated opportunity size"
            name="opportunitySize"
            options={OPPORTUNITY_SIZE_OPTIONS}
            value={form.priority.opportunitySize}
            onChange={(v) =>
              dispatch({ type: "priority", patch: { opportunitySize: v } })
            }
          />
          <TextField
            label="Next action"
            value={form.priority.nextAction}
            maxLength={200}
            placeholder="The next concrete step"
            onChange={(v) =>
              dispatch({ type: "priority", patch: { nextAction: v } })
            }
          />
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <CollapsibleSection title="Contact">
          <TextField
            label="Primary contact name"
            value={form.contact.name}
            onChange={(v) => dispatch({ type: "contact", patch: { name: v } })}
          />
          <TextField
            label="Title / role"
            value={form.contact.title}
            onChange={(v) =>
              dispatch({ type: "contact", patch: { title: v } })
            }
          />
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            value={form.contact.email}
            onChange={(v) =>
              dispatch({ type: "contact", patch: { email: v } })
            }
          />
          <TextField
            label="Phone"
            type="tel"
            inputMode="tel"
            value={form.contact.phone}
            onChange={(v) =>
              dispatch({ type: "contact", patch: { phone: v } })
            }
          />
          <CheckboxGroup
            label="Met with today"
            options={MET_WITH_OPTIONS}
            values={form.contact.metWith}
            onChange={handleMetWith}
          />
          <TextField
            label="Other contact"
            value={form.contact.otherContact}
            disabled={!form.contact.metWith.includes("Other")}
            hint={
              form.contact.metWith.includes("Other")
                ? undefined
                : 'Enable by checking "Other" above'
            }
            onChange={(v) =>
              dispatch({ type: "contact", patch: { otherContact: v } })
            }
          />
        </CollapsibleSection>

        <CollapsibleSection title="Purchasing">
          <RadioGroup
            label="Decision authority"
            name="decisionAuthority"
            options={DECISION_AUTHORITY_OPTIONS}
            value={form.purchasing.decisionAuthority}
            onChange={(v) =>
              dispatch({
                type: "purchasing",
                patch: { decisionAuthority: v },
              })
            }
          />
          <RadioGroup
            label="Procurement process"
            name="procurementProcess"
            options={PROCUREMENT_OPTIONS}
            value={form.purchasing.procurementProcess}
            onChange={(v) =>
              dispatch({
                type: "purchasing",
                patch: { procurementProcess: v },
              })
            }
          />
          <RadioGroup
            label="Budget status"
            name="budgetStatus"
            options={BUDGET_STATUS_OPTIONS}
            value={form.purchasing.budgetStatus}
            onChange={(v) =>
              dispatch({ type: "purchasing", patch: { budgetStatus: v } })
            }
          />
        </CollapsibleSection>

        <CollapsibleSection title="Decision-making">
          <CheckboxGroup
            label="Stakeholders involved"
            options={STAKEHOLDER_OPTIONS}
            values={form.decisionMaking.stakeholders}
            onChange={(next) =>
              dispatch({
                type: "decisionMaking",
                patch: { stakeholders: next },
              })
            }
          />
          <TextField
            label="Competing vendors mentioned"
            value={form.decisionMaking.competingVendors}
            onChange={(v) =>
              dispatch({
                type: "decisionMaking",
                patch: { competingVendors: v },
              })
            }
          />
          <RadioGroup
            label="Decision timeline"
            name="decisionTimeline"
            options={DECISION_TIMELINE_OPTIONS}
            value={form.decisionMaking.decisionTimeline}
            onChange={(v) =>
              dispatch({
                type: "decisionMaking",
                patch: { decisionTimeline: v },
              })
            }
          />
        </CollapsibleSection>

        <CollapsibleSection title="Marketing">
          <CheckboxGroup
            label="How did they hear about Wenger?"
            options={HEARD_ABOUT_OPTIONS}
            values={form.marketing.heardAbout}
            onChange={(next) =>
              dispatch({ type: "marketing", patch: { heardAbout: next } })
            }
          />
          <CheckboxGroup
            label="Materials left behind"
            options={MATERIALS_LEFT_OPTIONS}
            values={form.marketing.materialsLeft}
            onChange={(next) =>
              dispatch({ type: "marketing", patch: { materialsLeft: next } })
            }
          />
          <TextField
            label="Follow-up materials requested"
            value={form.marketing.followUpRequested}
            onChange={(v) =>
              dispatch({
                type: "marketing",
                patch: { followUpRequested: v },
              })
            }
          />
        </CollapsibleSection>

        <CollapsibleSection title="Notes">
          <TextArea
            label="Visit notes"
            rows={6}
            placeholder="Everything worth remembering from this visit…"
            value={form.notes}
            onChange={(v) => dispatch({ type: "notes", value: v })}
          />
          <p className="text-xs text-brand-navy/45">
            Photo attachments arrive in a later cycle.
          </p>
        </CollapsibleSection>
      </div>

      {/* Fixed save bar — full-bleed, above the mobile tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] z-20 border-t border-black/8 bg-white/95 px-5 py-3 backdrop-blur-md md:bottom-0">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-2">
          {saveError && (
            <p
              role="alert"
              className="w-full text-center text-xs font-medium text-red-600"
            >
              {saveError}
            </p>
          )}
          <button
            type="button"
            onClick={() => save("list")}
            disabled={saving}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-navy-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save submission"}
          </button>
          <button
            type="button"
            onClick={() => save("map")}
            disabled={saving}
            className="text-xs font-medium text-brand-navy/60 transition-colors hover:text-brand-navy disabled:opacity-60"
          >
            Save &amp; start another visit
          </button>
        </div>
      </div>

      {saved && (
        <div
          role="status"
          className="fixed inset-x-0 top-[calc(4rem_+_env(safe-area-inset-top))] z-40 flex justify-center px-4"
        >
          <div className="flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-medium text-white shadow-lg">
            <Check size={16} aria-hidden />
            Visit saved
          </div>
        </div>
      )}
    </div>
  );
}
