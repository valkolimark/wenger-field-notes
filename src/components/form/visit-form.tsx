"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import type { School } from "@/lib/schools";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CollapsibleSection } from "./collapsible-section";
import { RadioGroup, CheckboxGroup, TextField, TextArea } from "./fields";
import { PhotoStrip } from "./photo-strip";
import { PhotoSheet } from "./photo-sheet";
import {
  type VisitFormData,
  type Submission,
  createEmptyForm,
  newSubmissionId,
  formatRelative,
  formatVisitDate,
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
import {
  loadDraft,
  saveDraft,
  clearDraft,
  enqueuePending,
  updatePendingContent,
  localDb,
  enqueuePhoto,
  updateLocalPhotoCaption,
  deleteLocalPhoto,
  type LocalPhotoRow,
} from "@/lib/db/local";
import {
  compressForUpload,
  newPhotoId,
  MAX_PHOTOS_PER_SUBMISSION,
  PHOTOS_WARN_THRESHOLD,
} from "@/lib/photos";
import { drainOnce } from "@/lib/sync";

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

// Stable default for useLiveQuery so the form doesn't tear when the
// subscription hasn't returned yet on first render.
const EMPTY_PHOTOS: LocalPhotoRow[] = [];

/** The editable VisitFormData carried by an existing submission, deep
 *  cloned so the reducer never mutates the loaded row. */
function initialFormData(sub?: Submission): VisitFormData {
  if (!sub) return createEmptyForm();
  return JSON.parse(
    JSON.stringify({
      priority: sub.priority,
      contact: sub.contact,
      purchasing: sub.purchasing,
      decisionMaking: sub.decisionMaking,
      marketing: sub.marketing,
      notes: sub.notes,
    }),
  ) as VisitFormData;
}

export function VisitForm({
  school,
  editSubmission,
  isPendingEdit = false,
}: {
  school: School;
  editSubmission?: Submission;
  /** Cycle 12: edit-mode branch — pending rows are edited in-place in
   *  Dexie; synced rows go to PATCH /api/submissions/[id]. */
  isPendingEdit?: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { success, error: toastError, confirm } = useToast();
  const repId = session?.user?.repId ?? "";
  const repName = session?.user?.name ?? session?.user?.email ?? "";

  // Cycle 10: edit mode reuses this form, prefilled, and never touches
  // the localStorage draft system (no restore, no autosave).
  const isEdit = !!editSubmission;

  const [form, dispatch] = useReducer(
    reducer,
    editSubmission,
    initialFormData,
  );
  const [priorityError, setPriorityError] = useState<string>("");
  const [draftAt, setDraftAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Cycle 13: stable submissionId so photos enqueued to Dexie before
  // save can reference a known parent across refreshes/force-quits.
  // - new visit: minted lazily (newSubmissionId(school.id)); persisted
  //   onto the draft so a refresh restores it.
  // - edit:     fixed to editSubmission.id.
  const [submissionId, setSubmissionId] = useState<string>(() =>
    editSubmission ? editSubmission.id : "",
  );
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const warnedAtThresholdRef = useRef(false);

  const priorityRef = useRef<HTMLDivElement>(null);
  const baselineRef = useRef<string>(
    JSON.stringify(initialFormData(editSubmission)),
  );
  const restoredRef = useRef(false);

  // Restore an existing draft once (per rep + school) — new-visit only.
  // Cycle 12: drafts now live in IndexedDB (Dexie); loader is async.
  // Cycle 13: if the draft carries a submissionId, adopt it; otherwise
  //   mint one (will be persisted on the next autosave).
  useEffect(() => {
    if (isEdit || restoredRef.current || !repId) return;
    restoredRef.current = true;
    let cancelled = false;
    void (async () => {
      const draft = await loadDraft(repId, school.id);
      if (cancelled) return;
      if (draft) {
        dispatch({ type: "load", data: draft.data });
        baselineRef.current = JSON.stringify(draft.data);
        setDraftAt(draft.updatedAt);
        setSubmissionId(draft.submissionId ?? newSubmissionId(school.id));
      } else {
        setSubmissionId(newSubmissionId(school.id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, repId, school.id]);

  // Cycle 13: live photo list for this submission (Dexie subscription).
  // useLiveQuery re-runs when the photos table changes; we pass
  // `submissionId` in deps so the query rebinds when it becomes
  // available after the draft restore.
  const livePhotos = useLiveQuery(
    () =>
      submissionId
        ? localDb.photos
            .where("submissionId")
            .equals(submissionId)
            .sortBy("createdAtLocal")
        : Promise.resolve([] as LocalPhotoRow[]),
    [submissionId],
    EMPTY_PHOTOS,
  );

  const isDirty = JSON.stringify(form) !== baselineRef.current;
  // Cycle 13: "dirty" for the back-confirm now also covers any local
  // photos captured this session. Server-side existing photos (synced
  // submissions in edit mode) don't live in Dexie so they don't trip
  // the prompt.
  const hasLocalPhotos = (livePhotos?.length ?? 0) > 0;

  // Debounced draft autosave (500ms per Cycle 12) — new-visit only;
  // never in edit mode. Fire-and-forget; Dexie put is async.
  // Cycle 13: now also persists `submissionId` onto the draft so a
  // refresh restores the same identity.
  useEffect(() => {
    if (isEdit || !repId || !submissionId || !isDirty || saved) return;
    const t = setTimeout(() => {
      void saveDraft(repId, school.id, form, submissionId);
    }, 500);
    return () => clearTimeout(t);
  }, [isEdit, form, repId, school.id, submissionId, isDirty, saved]);

  async function deleteLocalPhotosForThisSubmission() {
    if (!submissionId) return;
    const rows = await localDb.photos
      .where("submissionId")
      .equals(submissionId)
      .toArray();
    await Promise.all(rows.map((p) => deleteLocalPhoto(p.id)));
  }

  async function discardDraft() {
    void clearDraft(repId, school.id);
    await deleteLocalPhotosForThisSubmission();
    const empty = createEmptyForm();
    dispatch({ type: "load", data: empty });
    baselineRef.current = JSON.stringify(empty);
    setDraftAt(null);
    // Mint a fresh submissionId so subsequent capture doesn't latch
    // onto the abandoned id.
    setSubmissionId(newSubmissionId(school.id));
    warnedAtThresholdRef.current = false;
  }

  async function handleBack() {
    if (isDirty || hasLocalPhotos) {
      const ok = await confirm({
        title: "Discard unsaved changes?",
        body: hasLocalPhotos
          ? "Your edits and any photos added on this device will be removed."
          : "Your edits to this visit haven't been saved.",
        confirmLabel: "Discard",
        destructive: true,
      });
      if (!ok) return;
      if (hasLocalPhotos) {
        await deleteLocalPhotosForThisSubmission();
      }
    }
    router.push(
      isEdit ? `/submissions/${editSubmission!.id}` : "/map",
    );
  }

  async function handleAddPhoto(file: File) {
    if (!submissionId) return;
    const current = livePhotos?.length ?? 0;
    if (current >= MAX_PHOTOS_PER_SUBMISSION) {
      toastError(
        `You've reached the ${MAX_PHOTOS_PER_SUBMISSION}-photo limit for one visit.`,
      );
      return;
    }
    try {
      const compressed = await compressForUpload(file);
      await enqueuePhoto({
        id: newPhotoId(),
        submissionId,
        blob: compressed.blob,
        thumbnailDataUrl: compressed.thumbnailDataUrl,
        caption: "",
        mimeType: compressed.mimeType,
        fileSize: compressed.fileSize,
        width: compressed.width,
        height: compressed.height,
        takenAt: new Date().toISOString(),
      });
      const after = current + 1;
      if (
        after >= PHOTOS_WARN_THRESHOLD &&
        !warnedAtThresholdRef.current &&
        after < MAX_PHOTOS_PER_SUBMISSION
      ) {
        warnedAtThresholdRef.current = true;
        toastError(
          `Heads up: ${after} photos on this visit — keep it tight (max ${MAX_PHOTOS_PER_SUBMISSION}).`,
        );
      }
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Couldn't read that photo — try another.";
      toastError(msg);
    }
  }

  async function handleCaptionChange(id: string, caption: string) {
    await updateLocalPhotoCaption(id, caption);
  }

  async function handleDeletePhoto(id: string) {
    await deleteLocalPhoto(id);
  }

  // If `activePhotoId` references a photo that was just deleted from
  // Dexie, `activePhoto` is undefined and the sheet simply unmounts —
  // the stale id is harmless (next open replaces it).
  const activePhoto =
    activePhotoId != null
      ? (livePhotos ?? []).find((p) => p.id === activePhotoId) ?? null
      : null;

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
    if (saving) return;
    if (!repId) {
      // Cycle 12: surface (don't silently swallow) the case where the
      // session hasn't loaded — e.g. /api/auth/session failed offline
      // before the SW had a cached copy.
      setSaveError(
        "Couldn't read your session — open the app online once and try again.",
      );
      return;
    }
    setSaveError(null);
    setSaving(true);

    // --- Edit branch -------------------------------------------------
    // Pending row → Dexie update (identity locked; sync engine has not
    //   seen it yet so this is safe and offline-capable).
    // Synced row → PATCH /api/submissions/[id] (Cycle 10 behavior).
    // Mid-sync race (pending → syncing/synced between page load and
    //   save) is detected by updatePendingContent returning
    //   {ok:false, reason:"not-pending"}; we redirect to the online
    //   edit URL with a `?just-synced=1` marker that EditSubmission
    //   reads to bypass Dexie and re-fetch from the server.
    if (isEdit && editSubmission) {
      if (isPendingEdit) {
        const r = await updatePendingContent(editSubmission.id, form);
        if (!r.ok && r.reason === "not-pending") {
          setSaving(false);
          success("This visit just synced — opening online edit");
          router.replace(
            `/submissions/${editSubmission.id}/edit?just-synced=1`,
          );
          return;
        }
        if (!r.ok) {
          setSaving(false);
          setSaveError(
            "Couldn't save your changes on this device — please try again.",
          );
          return;
        }
        setSaved(true);
        success("Pending edits saved");
        setTimeout(
          () => router.push(`/submissions/${editSubmission.id}`),
          700,
        );
        return;
      }

      try {
        const res = await fetch(
          `/api/submissions/${editSubmission.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...editSubmission, ...form }),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        setSaving(false);
        setSaveError(
          "Couldn't save your changes — check your connection and try again.",
        );
        return;
      }
      setSaved(true);
      success("Visit updated");
      setTimeout(
        () => router.push(`/submissions/${editSubmission.id}`),
        900,
      );
      return;
    }

    // --- New-visit branch (Cycle 12: local-first) --------------------
    // Write to the Dexie pending queue; the sync engine drains it when
    // /api/health says we're online. The row appears in My Submissions
    // immediately via the useLiveQuery merge.
    // Cycle 13: use the stable submissionId we minted up-front so any
    // photos already captured for this visit reference this same row.
    const submission: Submission = {
      id: submissionId || newSubmissionId(school.id),
      schoolId: school.id,
      schoolName: school.name,
      repId,
      repName,
      visitDate: new Date().toISOString(),
      ...form,
    };

    try {
      await enqueuePending(submission);
    } catch {
      setSaving(false);
      setSaveError(
        "Couldn't save on this device — please try again.",
      );
      return;
    }

    // Kick the sync engine so an online rep sees the row flip to synced
    // within a couple of seconds, not on the next 60s tick. Offline,
    // the ping fails and the row stays pending for the next trigger.
    void drainOnce();

    void clearDraft(repId, school.id);
    setSaved(true);
    success("Visit saved");
    setTimeout(
      () => router.push(then === "map" ? "/map" : "/submissions"),
      then === "map" ? 600 : 1100,
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
        {isEdit ? "Back to submission" : "Back to map"}
      </button>

      <header className="mt-4">
        <h1 className="text-3xl leading-tight text-brand-navy">
          {school.name}
        </h1>
        <p className="mt-1 text-sm text-brand-navy/55">
          {school.location}
        </p>
        <p className="mt-1 text-xs text-brand-navy/40">
          {isEdit
            ? `Editing a saved visit · logged ${formatVisitDate(
                editSubmission!.visitDate,
              )}`
            : "Your progress auto-saves as a draft on this device."}
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

        <CollapsibleSection title="Photos">
          <PhotoStrip
            photos={livePhotos ?? EMPTY_PHOTOS}
            onAdd={(file) => void handleAddPhoto(file)}
            onSelect={setActivePhotoId}
            disabled={!submissionId}
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
        </CollapsibleSection>
      </div>

      {activePhoto && (
        <PhotoSheet
          photo={activePhoto}
          onCaptionChange={(c) => handleCaptionChange(activePhoto.id, c)}
          onDelete={() => handleDeletePhoto(activePhoto.id)}
          onClose={() => setActivePhotoId(null)}
        />
      )}

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
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => save("list")}
            disabled={saving}
            className="w-full"
          >
            {saving
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Save submission"}
          </Button>
          {!isEdit && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => save("map")}
              disabled={saving}
              className="h-9 text-xs"
            >
              Save &amp; start another visit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
