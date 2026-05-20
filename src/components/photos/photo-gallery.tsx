"use client";

// Cycle 13: read-side photo display for /submissions/[id] (rep) and
// the /admin Submissions expandable row (admin). Merges server-side
// photos (fetched via GET /api/submissions/[id]/photos and rendered
// through the /api/photos/[id]/file private-blob proxy) with any
// locally-pending photos still in IndexedDB (mid-sync, or attached
// to a still-pending submission). Tap → opens <PhotoLightbox> with
// the full image. Owner/admin can delete; the lightbox handles the
// confirm + DELETE call for synced photos, or removes the local
// Dexie row for not-yet-uploaded photos.

import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ImageOff, RotateCw } from "lucide-react";
import {
  localDb,
  type LocalPhotoRow,
} from "@/lib/db/local";
import { PhotoLightbox } from "./photo-lightbox";

export interface ServerPhotoDTO {
  id: string;
  submissionId: string;
  caption: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  takenAt: string;
  uploadedAt: string;
}

export interface GalleryItem {
  id: string;
  source: "server" | "local";
  thumbSrc?: string;
  caption: string;
  status?: LocalPhotoRow["status"];
  takenAt: string;
}

const EMPTY_LOCAL: LocalPhotoRow[] = [];

export function PhotoGallery({
  submissionId,
  isPending = false,
  canDelete = false,
  onDeleted,
  onLoaded,
}: {
  submissionId: string;
  /** Cycle 12 pending row → no server photos to fetch. */
  isPending?: boolean;
  canDelete?: boolean;
  onDeleted?: () => void;
  /** Bubbles the count of server-side photos once GET completes.
   *  Used by /admin to gate the "Deep analysis" button. */
  onLoaded?: (serverPhotoCount: number) => void;
}) {
  const [serverPhotos, setServerPhotos] = useState<ServerPhotoDTO[]>([]);
  const [serverState, setServerState] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [activeId, setActiveId] = useState<string | null>(null);

  const localPhotos =
    useLiveQuery(
      () =>
        submissionId
          ? localDb.photos
              .where("submissionId")
              .equals(submissionId)
              .sortBy("createdAtLocal")
          : Promise.resolve(EMPTY_LOCAL),
      [submissionId],
      EMPTY_LOCAL,
    ) ?? EMPTY_LOCAL;

  const loadServer = useCallback(async () => {
    if (isPending) {
      setServerPhotos([]);
      setServerState("ok");
      onLoaded?.(0);
      return;
    }
    setServerState("loading");
    try {
      const res = await fetch(
        `/api/submissions/${submissionId}/photos`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ServerPhotoDTO[];
      setServerPhotos(data);
      setServerState("ok");
      onLoaded?.(data.length);
    } catch {
      setServerState("error");
    }
  }, [submissionId, isPending, onLoaded]);

  useEffect(() => {
    void loadServer();
  }, [loadServer]);

  // Items: server first (oldest takenAt first), then local pending.
  const items: GalleryItem[] = [
    ...serverPhotos.map<GalleryItem>((p) => ({
      id: p.id,
      source: "server",
      thumbSrc: `/api/photos/${p.id}/file`,
      caption: p.caption,
      takenAt: p.takenAt,
    })),
    ...localPhotos
      // Hide local rows whose server twin already came back from the
      // GET — this happens for ~one render after upload completes
      // and before deleteLocalPhoto() runs.
      .filter((p) => !serverPhotos.some((sp) => sp.id === p.id))
      .map<GalleryItem>((p) => ({
        id: p.id,
        source: "local",
        thumbSrc: p.thumbnailDataUrl,
        caption: p.caption,
        status: p.status,
        takenAt: p.takenAt,
      })),
  ];

  if (serverState === "loading") {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square animate-pulse rounded-xl bg-black/[0.06]"
          />
        ))}
      </div>
    );
  }
  if (serverState === "error") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <span>Couldn&apos;t load photos.</span>
        <button
          type="button"
          onClick={() => void loadServer()}
          className="shrink-0 font-semibold text-red-700 underline underline-offset-2 hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-brand-navy/50">No photos for this visit.</p>
    );
  }

  const active = items.find((i) => i.id === activeId) ?? null;
  const activeLocal = active?.source === "local"
    ? localPhotos.find((p) => p.id === active.id) ?? null
    : null;

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <li key={`${item.source}-${item.id}`} className="relative">
            <button
              type="button"
              onClick={() => setActiveId(item.id)}
              aria-label={
                item.caption
                  ? `View photo: ${item.caption}`
                  : `View photo from ${new Date(item.takenAt).toLocaleString()}`
              }
              className="block aspect-square w-full overflow-hidden rounded-xl border border-black/10 bg-black/[0.04] transition-transform duration-200 ease-out active:scale-[0.97]"
            >
              {item.thumbSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbSrc}
                  alt={item.caption || ""}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-brand-navy/30">
                  <ImageOff size={24} aria-hidden />
                </div>
              )}
            </button>
            {item.source === "local" && (
              <LocalPill status={item.status} />
            )}
          </li>
        ))}
      </ul>

      {active && (
        <PhotoLightbox
          item={active}
          localRow={activeLocal}
          canDelete={canDelete}
          onClose={() => setActiveId(null)}
          onDeleted={() => {
            setActiveId(null);
            // Server-side delete invalidates our cached list.
            if (active.source === "server") void loadServer();
            onDeleted?.();
          }}
        />
      )}
    </>
  );
}

function LocalPill({ status }: { status?: LocalPhotoRow["status"] }) {
  if (!status || status === "uploaded") return null;
  if (status === "uploading") {
    return (
      <span className="pointer-events-none absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-brand-warm/95 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
        <RotateCw size={10} className="animate-spin" aria-hidden />
        Uploading
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-danger/95 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
        Failed
      </span>
    );
  }
  // pending
  return (
    <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-brand-navy/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
      Pending
    </span>
  );
}
