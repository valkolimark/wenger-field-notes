"use client";

// Cycle 13: full-size photo viewer opened from <PhotoGallery>. For
// server photos, src is the /api/photos/[id]/file proxy (private
// blob → authed stream → browser cache). For local/pending photos,
// we render the in-memory Blob via an Object URL (full ~1600px JPEG
// the rep just captured), falling back to thumbnailDataUrl after
// reload if the Blob isn't available.

import { useEffect, useMemo, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteLocalPhoto, type LocalPhotoRow } from "@/lib/db/local";
import type { GalleryItem } from "./photo-gallery";

export function PhotoLightbox({
  item,
  localRow,
  canDelete,
  onClose,
  onDeleted,
}: {
  item: GalleryItem;
  /** Present iff item.source === "local"; carries the actual Blob. */
  localRow: LocalPhotoRow | null;
  canDelete: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { confirm, success, error: toastError } = useToast();
  const [busy, setBusy] = useState(false);

  // Object URL for in-memory local blobs (fullest fidelity available
  // for not-yet-uploaded photos). Cleaned up on unmount.
  const objectUrl = useMemo(() => {
    if (item.source === "local" && localRow?.blob) {
      return URL.createObjectURL(localRow.blob);
    }
    return null;
  }, [item.source, localRow?.blob]);
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const src =
    objectUrl ??
    (item.source === "server"
      ? `/api/photos/${item.id}/file`
      : localRow?.thumbnailDataUrl ?? null);

  async function handleDelete() {
    if (busy) return;
    const ok = await confirm({
      title: "Delete this photo?",
      body:
        item.source === "local"
          ? "This photo is still on this device and hasn't uploaded yet — it will be removed and never sent to the server."
          : "This permanently removes the photo. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      if (item.source === "server") {
        const res = await fetch(`/api/photos/${item.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        await deleteLocalPhoto(item.id);
      }
      success("Photo deleted");
      onDeleted();
    } catch {
      setBusy(false);
      toastError("Couldn't delete this photo — please try again.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2100] flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl animate-pop overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
        >
          <X size={18} aria-hidden />
        </button>

        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.caption || ""}
            className="block max-h-[75vh] w-full bg-black object-contain"
          />
        ) : (
          <div className="grid h-72 w-full place-items-center bg-black/70 text-white/70">
            Preview unavailable
          </div>
        )}

        <div className="space-y-3 px-4 py-3">
          {item.caption && (
            <p className="text-sm leading-relaxed text-brand-navy/85">
              {item.caption}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-brand-navy/45">
              {new Date(item.takenAt).toLocaleString()}
            </span>
            {canDelete && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={busy}
                className="px-3"
              >
                <Trash2 size={16} aria-hidden />
                {busy ? "Deleting…" : "Delete"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
