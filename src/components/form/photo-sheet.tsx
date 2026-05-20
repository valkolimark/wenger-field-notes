"use client";

// Cycle 13: per-photo sheet opened from <PhotoStrip>. Shows a larger
// preview (the captured thumbnail data URL — full bytes stay in
// IndexedDB as a Blob until upload), a single-line caption field
// (max 120 chars), and a Delete button. Matches the existing confirm
// modal in <ToastProvider> for shape/animation.

import { useEffect, useState } from "react";
import { X, Trash2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LocalPhotoRow } from "@/lib/db/local";
import { retryPhoto } from "@/lib/sync";

const MAX_CAPTION = 120;

export function PhotoSheet({
  photo,
  onCaptionChange,
  onDelete,
  onClose,
}: {
  photo: LocalPhotoRow;
  onCaptionChange: (caption: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [caption, setCaption] = useState(photo.caption);
  const [busy, setBusy] = useState(false);

  // Esc closes — same affordance the confirm modal uses (overlay tap).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Persist caption changes on blur to keep this sheet keystroke-cheap.
  async function commitCaption() {
    if (caption === photo.caption) return;
    await onCaptionChange(caption);
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const captionEditable = photo.status !== "uploaded";

  return (
    <div
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4"
      onClick={() => {
        void commitCaption();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md animate-pop overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50"
        >
          <X size={18} aria-hidden />
        </button>

        {photo.thumbnailDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.thumbnailDataUrl}
            alt=""
            className="block max-h-[55vh] w-full bg-black object-contain"
          />
        ) : (
          <div className="grid h-48 w-full place-items-center bg-black/70 text-white/60">
            Preview unavailable
          </div>
        )}

        <div className="space-y-4 p-4">
          <div>
            <label className="block">
              <span className="block text-xs font-medium uppercase tracking-wide text-brand-navy/55">
                Caption
              </span>
              <input
                type="text"
                value={caption}
                maxLength={MAX_CAPTION}
                disabled={!captionEditable}
                placeholder="e.g. Existing gym risers"
                onChange={(e) => setCaption(e.target.value)}
                onBlur={() => void commitCaption()}
                className="mt-1.5 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-brand-navy outline-none transition-colors placeholder:text-brand-navy/35 focus-visible:border-brand-navy/40 focus-visible:ring-2 focus-visible:ring-brand-navy/15 disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-brand-navy/40"
              />
            </label>
            <div className="mt-1 flex justify-between text-xs text-brand-navy/45">
              <span>
                {captionEditable
                  ? "Tap outside to save"
                  : "Captions can't change after upload"}
              </span>
              <span>
                {caption.length}/{MAX_CAPTION}
              </span>
            </div>
          </div>

          {photo.status === "failed" && (
            <div className="rounded-xl border border-danger/30 bg-danger/[0.05] px-3 py-2 text-xs text-danger">
              Upload didn&apos;t finish after several tries
              {photo.lastError ? ` (${photo.lastError})` : ""}.
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={async () => {
                await commitCaption();
                onClose();
              }}
            >
              Done
            </Button>
            {photo.status === "failed" && (
              <Button
                variant="primary"
                onClick={async () => {
                  await retryPhoto(photo.id);
                  onClose();
                }}
                aria-label="Retry upload"
                className="px-3"
              >
                <RotateCw size={16} aria-hidden />
                Retry
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={busy}
              aria-label="Delete this photo"
              className="px-3"
            >
              <Trash2 size={16} aria-hidden />
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
