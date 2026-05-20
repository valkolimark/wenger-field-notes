"use client";

// Cycle 13: the photo strip inside <VisitForm>. Renders a tap-to-add
// button plus a horizontal scrolling row of thumbnails for photos
// captured for this submission. Each thumbnail shows a status pill;
// tapping a thumbnail opens <PhotoSheet> for caption/delete.
//
// Cap-at-20 / warn-at-15 lives here (spec Q3). Add button disables
// at the cap; we surface the warning via a toast emitted by the parent
// so the strip stays stateless.

import { useRef } from "react";
import { Camera, ImageOff, RotateCw, Check } from "lucide-react";
import type { LocalPhotoRow } from "@/lib/db/local";
import { MAX_PHOTOS_PER_SUBMISSION } from "@/lib/photos";

export function PhotoStrip({
  photos,
  onAdd,
  onSelect,
  disabled,
}: {
  photos: LocalPhotoRow[];
  onAdd: (file: File) => void;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const atCap = photos.length >= MAX_PHOTOS_PER_SUBMISSION;
  const addDisabled = disabled || atCap;

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onAdd(file);
    // Reset so the same file (or another shot) can be picked again.
    e.target.value = "";
  }

  // Empty state — single full-width Add button + helper copy.
  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-brand-navy/20 bg-brand-navy/[0.02] px-4 py-6 text-center">
        <p className="text-sm text-brand-navy/70">No photos yet.</p>
        <p className="mt-1 text-xs text-brand-navy/45">
          Photos help the team see what you saw.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={addDisabled}
          className="mt-4 inline-flex h-11 min-w-44 items-center justify-center gap-2 rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-brand-navy-light disabled:pointer-events-none disabled:opacity-50"
        >
          <Camera size={18} aria-hidden />
          Add photo
        </button>
        <HiddenInput inputRef={inputRef} onPick={handlePick} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {photos.map((p) => (
          <ThumbButton key={p.id} photo={p} onSelect={onSelect} />
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={addDisabled}
          aria-label="Add another photo"
          className="flex h-22 w-22 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-navy/25 bg-brand-navy/[0.02] text-brand-navy/60 transition-colors hover:border-brand-navy/40 hover:text-brand-navy disabled:pointer-events-none disabled:opacity-40"
          style={{ height: 88, width: 88 }}
        >
          <Camera size={20} aria-hidden />
          <span className="text-[10px] font-medium">Add</span>
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-brand-navy/45">
        <span>
          {photos.length}/{MAX_PHOTOS_PER_SUBMISSION} photos
        </span>
        {atCap && (
          <span className="font-medium text-brand-warm">
            Photo limit reached
          </span>
        )}
      </div>
      <HiddenInput inputRef={inputRef} onPick={handlePick} />
    </div>
  );
}

function HiddenInput({
  inputRef,
  onPick,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      // `capture="environment"` opens the rear camera on iOS/Android;
      // desktop falls back to a normal file picker.
      capture="environment"
      onChange={onPick}
      className="sr-only"
      aria-hidden
      tabIndex={-1}
    />
  );
}

function ThumbButton({
  photo,
  onSelect,
}: {
  photo: LocalPhotoRow;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(photo.id)}
      aria-label={
        photo.caption
          ? `Photo: ${photo.caption}`
          : `Photo from ${new Date(photo.takenAt).toLocaleString()}`
      }
      className="relative shrink-0 overflow-hidden rounded-xl border border-black/10 bg-black/[0.04] transition-transform duration-200 ease-out active:scale-[0.97]"
      style={{ height: 88, width: 88 }}
    >
      {photo.thumbnailDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.thumbnailDataUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-brand-navy/30">
          <ImageOff size={20} aria-hidden />
        </div>
      )}
      <StatusPill status={photo.status} retryCount={photo.retryCount} />
    </button>
  );
}

function StatusPill({
  status,
  retryCount,
}: {
  status: LocalPhotoRow["status"];
  retryCount?: number;
}) {
  // Status pill: brand-navy default for "pending", warm `#b8612a` for
  // "uploading" (matches the priority accent), calm green check for
  // "uploaded" (transient — rows are deleted on success, so this is
  // rarely seen), red for "failed". All pills sit at bottom-left and
  // stay legible over varied thumbnails.
  if (status === "pending") {
    return (
      <span className="absolute bottom-1 left-1 rounded-full bg-brand-navy/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
        Pending
      </span>
    );
  }
  if (status === "uploading") {
    return (
      <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-brand-warm/95 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
        <RotateCw size={10} className="animate-spin" aria-hidden />
        Uploading
      </span>
    );
  }
  if (status === "uploaded") {
    return (
      <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
        <Check size={10} aria-hidden />
        Done
      </span>
    );
  }
  return (
    <span
      className="absolute bottom-1 left-1 rounded-full bg-danger/95 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
      title={retryCount ? `Retried ${retryCount}×` : undefined}
    >
      Failed
    </span>
  );
}
