"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { type School, CUSTOM_SCHOOL_ID } from "@/lib/schools";
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
  type ContactBlock,
  type ProjectsNeedsBlock,
  type PurchasingBlock,
  type MarketingBlock,
  createEmptyForm,
  newSubmissionId,
  formatRelative,
  formatVisitDate,
  normalizeFormData,
  TIMELINE_OPTIONS,
  DECISION_MAKER_OPTIONS,
  DEALER_OPTIONS,
  FUNDING_OPTIONS,
  MARKETING_CHANNEL_OPTIONS,
  SOCIAL_PLATFORM_OPTIONS,
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
  | { type: "contact"; patch: Partial<ContactBlock> }
  | { type: "projectsNeeds"; patch: Partial<ProjectsNeedsBlock> }
  | { type: "purchasing"; patch: Partial<PurchasingBlock> }
  | { type: "marketing"; patch: Partial<MarketingBlock> }
  | { type: "notes"; value: string }
  | { type: "load"; data: VisitFormData };

function reducer(state: VisitFormData, action: Action): VisitFormData {
  switch (action.type) {
    case "contact":
      return { ...state, contact: { ...state.contact, ...action.patch } };
    case "projectsNeeds":
      return {
        ...state,
        projectsNeeds: { ...state.projectsNeeds, ...action.patch },
      };
    case "purchasing":
      return {
        ...state,
        purchasing: { ...state.purchasing, ...action.patch },
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

// Cycle 18: option sets reused by the form's radio/checkbox groups.
// The canonical lists are augmented with "Other" for the form layer
// (the data model keeps "Other" out of the canonical arrays and stores
// the fill-in text in a parallel `*Other` field).
const DECISION_MAKER_WITH_OTHER = [
  ...DECISION_MAKER_OPTIONS,
  "Other",
] as const;
const DEALER_WITH_OTHER = [...DEALER_OPTIONS, "Other"] as const;
const FUNDING_WITH_OTHER = [...FUNDING_OPTIONS, "Other"] as const;
const MARKETING_CHANNEL_WITH_OTHER = [
  ...MARKETING_CHANNEL_OPTIONS,
  "Other",
] as const;

/** The editable VisitFormData carried by an existing submission, deep
 *  cloned so the reducer never mutates the loaded row. */
function initialFormData(sub?: Submission): VisitFormData {
  if (!sub) return createEmptyForm();
  return JSON.parse(
    JSON.stringify({
      contact: sub.contact,
      projectsNeeds: sub.projectsNeeds,
      purchasing: sub.purchasing,
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

  // Cycle 19: off-list ("ad-hoc") visit mode. The rep typed
  // /form/custom (or tapped "School not listed"); the contact block
  // swaps the contacts dropdown for a "School name" text field.
  const isCustom = school.id === CUSTOM_SCHOOL_ID;

  const [form, dispatch] = useReducer(
    reducer,
    editSubmission,
    initialFormData,
  );
  const [draftAt, setDraftAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Cycle 19: typed school name for custom visits. NOT part of
  // VisitFormData — that would collide with Submission.schoolName under
  // the `...normalized` save-path spread (could wipe a listed school's
  // name). Seeded from the submission when editing a custom row.
  const [customSchoolName, setCustomSchoolName] = useState<string>(() =>
    isCustom && editSubmission ? editSubmission.schoolName : "",
  );

  // Cycle 13: stable submissionId so photos enqueued to Dexie before
  // save can reference a known parent across refreshes/force-quits.
  const [submissionId, setSubmissionId] = useState<string>(() =>
    editSubmission ? editSubmission.id : "",
  );
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const warnedAtThresholdRef = useRef(false);

  const baselineRef = useRef<string>(
    JSON.stringify(initialFormData(editSubmission)),
  );
  const restoredRef = useRef(false);

  // Restore an existing draft once (per rep + school) — new-visit only.
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
        // Cycle 19: restore the typed school name for off-list drafts.
        if (isCustom && typeof draft.customSchoolName === "string") {
          setCustomSchoolName(draft.customSchoolName);
        }
      } else {
        setSubmissionId(newSubmissionId(school.id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, repId, school.id]);

  // Live photo list for this submission (Dexie subscription).
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

  // Cycle 19: typing only the school name on a new custom visit must
  // count as dirty so the debounced autosave fires (otherwise the rep
  // could fill the name, switch apps, come back, and find no draft).
  const customNameDirty = isCustom && customSchoolName.length > 0;
  const isDirty =
    JSON.stringify(form) !== baselineRef.current || customNameDirty;
  const hasLocalPhotos = (livePhotos?.length ?? 0) > 0;

  // Debounced draft autosave (500ms) — new-visit only.
  useEffect(() => {
    if (isEdit || !repId || !submissionId || !isDirty || saved) return;
    const t = setTimeout(() => {
      void saveDraft(
        repId,
        school.id,
        form,
        submissionId,
        isCustom ? customSchoolName : undefined,
      );
    }, 500);
    return () => clearTimeout(t);
  }, [
    isEdit,
    form,
    repId,
    school.id,
    submissionId,
    isDirty,
    saved,
    isCustom,
    customSchoolName,
  ]);

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
    setSubmissionId(newSubmissionId(school.id));
    warnedAtThresholdRef.current = false;
    // Cycle 19: also clear the typed school name on off-list drafts.
    if (isCustom) setCustomSchoolName("");
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

  const activePhoto =
    activePhotoId != null
      ? (livePhotos ?? []).find((p) => p.id === activePhotoId) ?? null
      : null;

  // Cycle 18: no required fields (priority block is gone — cold calls
  // may capture very little). Save always enabled; normalize the form
  // before persisting so nested socials are cleared when Social Media
  // isn't checked + orphan Other text is trimmed.
  async function save(then: "list" | "map") {
    if (saving) return;
    if (!repId) {
      setSaveError(
        "Couldn't read your session — open the app online once and try again.",
      );
      return;
    }
    // Cycle 19: off-list visits MUST carry a typed school name on save
    // (new-visit branch only — edit mode disables the field and can't
    // change it anyway because PATCH treats schoolName as immutable).
    // This is the only custom-only required field; the rest of the
    // form remains "save anything" (Cycle 18 cold-call cadence).
    if (isCustom && !isEdit && customSchoolName.trim() === "") {
      setSaveError("Enter the school's name before saving this visit.");
      return;
    }
    setSaveError(null);
    setSaving(true);

    const normalized = normalizeFormData(form);

    // --- Edit branch -------------------------------------------------
    if (isEdit && editSubmission) {
      if (isPendingEdit) {
        const r = await updatePendingContent(editSubmission.id, normalized);
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
            body: JSON.stringify({ ...editSubmission, ...normalized }),
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
    // Cycle 19: custom visits use the typed name; listed visits use the
    // dataset name. schoolId stays as school.id (either the dataset id
    // or the literal "custom" sentinel) — Postgres stores it as plain
    // text either way, no schema change.
    const submission: Submission = {
      id: submissionId || newSubmissionId(school.id),
      schoolId: school.id,
      schoolName: isCustom ? customSchoolName.trim() : school.name,
      repId,
      repName,
      visitDate: new Date().toISOString(),
      ...normalized,
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

    void drainOnce();
    void clearDraft(repId, school.id);
    setSaved(true);
    success("Visit saved");
    setTimeout(
      () => router.push(then === "map" ? "/map" : "/submissions"),
      then === "map" ? 600 : 1100,
    );
  }

  // Local toggle helper for multi-select arrays that may also carry "Other".
  function toggle(arr: string[], value: string): string[] {
    return arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value];
  }

  const decisionIsOther = form.purchasing.decisionMaker === "Other";
  const dealersOtherChecked = form.purchasing.dealers.includes("Other");
  const fundingOtherChecked = form.purchasing.funding.includes("Other");
  const channelsOtherChecked = form.marketing.channels.includes("Other");
  const socialChecked = form.marketing.channels.includes("Social Media");

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
          {isCustom
            ? customSchoolName.trim() || "New off-list visit"
            : school.name}
        </h1>
        {/* Cycle 19: off-list visits have no dataset location; show a
            subtitle instead on new visits. Edit mode shows nothing
            below the heading (the disabled name field below makes the
            context obvious). */}
        {isCustom ? (
          !isEdit && (
            <p className="mt-1 text-sm text-brand-navy/55">
              A school that isn&apos;t on your list
            </p>
          )
        ) : (
          <p className="mt-1 text-sm text-brand-navy/55">
            {school.location}
          </p>
        )}
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

      {/* Cycle 18: contact-first block. NOT collapsible — it's the
          primary entry point and should be the first thing the rep
          touches.
          Cycle 19: in custom mode the contacts dropdown is replaced
          with a "School name" text field (editable on new, disabled
          on edit because PATCH treats schoolName as immutable). */}
      <section className="mt-5 rounded-2xl border border-black/8 bg-white px-4 py-5 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy/55">
          Contact
        </p>

        {isCustom ? (
          <TextField
            label="School name"
            value={isEdit ? school.name : customSchoolName}
            disabled={isEdit}
            placeholder="The school's name"
            hint={
              isEdit
                ? "School name can't be changed after the visit is saved."
                : "This school isn't on your list — type its name."
            }
            onChange={(v) => setCustomSchoolName(v)}
          />
        ) : (
          <div>
            <label className="block">
              <span className="block text-sm font-medium text-brand-navy">
                Who did you meet with?
              </span>
              <select
                value={form.contact.selectedContactName}
                onChange={(e) =>
                  dispatch({
                    type: "contact",
                    patch: { selectedContactName: e.target.value },
                  })
                }
                className="mt-1.5 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-brand-navy outline-none transition-colors focus-visible:border-brand-navy/40 focus-visible:ring-2 focus-visible:ring-brand-navy/15"
              >
                <option value="">
                  {school.contacts.length === 0
                    ? "No contacts on file for this school"
                    : "Pick a person…"}
                </option>
                {school.contacts.map((c) => (
                  <option key={`${c.role}-${c.name}`} value={c.name}>
                    {c.name} — {c.role}
                  </option>
                ))}
              </select>
            </label>
            {school.contacts.length === 0 && (
              <p className="mt-1 text-xs text-brand-navy/45">
                Use the &quot;Met with someone else&quot; field below.
              </p>
            )}
          </div>
        )}

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
        <TextField
          label="Met with someone else"
          value={form.contact.metSomeoneElse}
          placeholder="Name (and role, if you'd like)"
          onChange={(v) =>
            dispatch({ type: "contact", patch: { metSomeoneElse: v } })
          }
        />
      </section>

      <div className="mt-5 space-y-4">
        <CollapsibleSection title="Projects / Needs">
          <TextArea
            label="Do they have any upcoming projects planned?"
            rows={3}
            value={form.projectsNeeds.upcomingProjects}
            onChange={(v) =>
              dispatch({
                type: "projectsNeeds",
                patch: { upcomingProjects: v },
              })
            }
          />
          <TextArea
            label="Do they have any current needs we can help with?"
            rows={3}
            value={form.projectsNeeds.currentNeeds}
            onChange={(v) =>
              dispatch({
                type: "projectsNeeds",
                patch: { currentNeeds: v },
              })
            }
          />
          <RadioGroup
            label="If current needs, what is their timeline?"
            name="timeline"
            options={TIMELINE_OPTIONS}
            value={form.projectsNeeds.timeline}
            onChange={(v) =>
              dispatch({
                type: "projectsNeeds",
                patch: { timeline: v as ProjectsNeedsBlock["timeline"] },
              })
            }
          />
        </CollapsibleSection>

        <CollapsibleSection title="Purchasing">
          <RadioGroup
            label="Who makes the decisions as far as athletics or music goes?"
            name="decisionMaker"
            options={DECISION_MAKER_WITH_OTHER}
            value={form.purchasing.decisionMaker}
            onChange={(v) =>
              dispatch({
                type: "purchasing",
                patch: {
                  decisionMaker:
                    v as PurchasingBlock["decisionMaker"],
                  ...(v === "Other"
                    ? {}
                    : { decisionMakerOther: "" }),
                },
              })
            }
          />
          <TextField
            label="Other decision-maker"
            value={form.purchasing.decisionMakerOther}
            disabled={!decisionIsOther}
            hint={
              decisionIsOther
                ? undefined
                : 'Enable by selecting "Other" above'
            }
            onChange={(v) =>
              dispatch({
                type: "purchasing",
                patch: { decisionMakerOther: v },
              })
            }
          />
          <TextField
            label="What vendor do they currently use to purchase music equipment?"
            value={form.purchasing.musicVendor}
            onChange={(v) =>
              dispatch({ type: "purchasing", patch: { musicVendor: v } })
            }
          />
          <TextField
            label="What vendor do they currently use to purchase athletic equipment?"
            value={form.purchasing.athleticVendor}
            onChange={(v) =>
              dispatch({
                type: "purchasing",
                patch: { athleticVendor: v },
              })
            }
          />
          <CheckboxGroup
            label="Do they use dealers? If so, who?"
            options={DEALER_WITH_OTHER}
            values={form.purchasing.dealers}
            onChange={(next) =>
              dispatch({
                type: "purchasing",
                patch: {
                  dealers: next,
                  ...(next.includes("Other")
                    ? {}
                    : { dealersOther: "" }),
                },
              })
            }
          />
          <TextField
            label="Other dealer"
            value={form.purchasing.dealersOther}
            disabled={!dealersOtherChecked}
            hint={
              dealersOtherChecked
                ? undefined
                : 'Enable by checking "Other" above'
            }
            onChange={(v) =>
              dispatch({
                type: "purchasing",
                patch: { dealersOther: v },
              })
            }
          />
          <TextField
            label="Do they purchase through national contracts or co-ops? If yes, capture what they use."
            value={form.purchasing.contractsCoops}
            onChange={(v) =>
              dispatch({
                type: "purchasing",
                patch: { contractsCoops: v },
              })
            }
          />
          <CheckboxGroup
            label="How are projects or purchases funded?"
            options={FUNDING_WITH_OTHER}
            values={form.purchasing.funding}
            onChange={(next) =>
              dispatch({
                type: "purchasing",
                patch: {
                  funding: next,
                  ...(next.includes("Other")
                    ? {}
                    : { fundingOther: "" }),
                },
              })
            }
          />
          <TextField
            label="Other funding source"
            value={form.purchasing.fundingOther}
            disabled={!fundingOtherChecked}
            hint={
              fundingOtherChecked
                ? undefined
                : 'Enable by checking "Other" above'
            }
            onChange={(v) =>
              dispatch({
                type: "purchasing",
                patch: { fundingOther: v },
              })
            }
          />
        </CollapsibleSection>

        <CollapsibleSection title="Marketing">
          <CheckboxGroup
            label="How do they prefer to consume marketing information?"
            options={MARKETING_CHANNEL_WITH_OTHER}
            values={form.marketing.channels}
            onChange={(next) =>
              dispatch({
                type: "marketing",
                patch: {
                  channels: next,
                  ...(next.includes("Other")
                    ? {}
                    : { channelsOther: "" }),
                  ...(next.includes("Social Media")
                    ? {}
                    : { socialPlatforms: [] }),
                },
              })
            }
          />
          {socialChecked && (
            <div className="rounded-xl bg-brand-navy/[0.03] p-3">
              <CheckboxGroup
                label="Which platforms?"
                options={SOCIAL_PLATFORM_OPTIONS}
                values={form.marketing.socialPlatforms}
                onChange={(next) =>
                  dispatch({
                    type: "marketing",
                    patch: { socialPlatforms: next },
                  })
                }
              />
            </div>
          )}
          <TextField
            label="Other channel"
            value={form.marketing.channelsOther}
            disabled={!channelsOtherChecked}
            hint={
              channelsOtherChecked
                ? undefined
                : 'Enable by checking "Other" above'
            }
            onChange={(v) =>
              dispatch({
                type: "marketing",
                patch: { channelsOther: v },
              })
            }
          />
          <TextField
            label="What kind of trade shows or events do they attend?"
            value={form.marketing.tradeShows}
            onChange={(v) =>
              dispatch({ type: "marketing", patch: { tradeShows: v } })
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
