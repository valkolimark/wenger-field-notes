// Cycle 13: client-side photo capture helpers.
//
// `compressForUpload` runs the raw camera File through
// `browser-image-compression` (Web Worker) and emits a JPEG Blob plus
// a small ~240px thumbnail data URL for instant rendering and reload
// survival. Width/height come from a transient HTMLImageElement.
//
// Constants here drive the UI cap (20) and the soft warning threshold
// (15). The cap also keeps the Cycle 13 deep-dive vision summary
// (high-detail, ~1.6k tokens/photo) under the 60k input-token budget.

import imageCompression from "browser-image-compression";

export const MAX_PHOTOS_PER_SUBMISSION = 20;
export const PHOTOS_WARN_THRESHOLD = 15;
/** Defensive cap on the raw input File size. Modern phone JPEGs are well
 *  under this even at 48MP; HEIC-converted-to-JPEG on iOS sometimes
 *  spikes. Anything larger is almost certainly user error (PSD, RAW). */
export const MAX_INPUT_FILE_BYTES = 12 * 1024 * 1024;

const THUMBNAIL_MAX_DIM = 240;

export interface CompressedPhoto {
  /** Compressed JPEG bytes ready to put() into Vercel Blob. */
  blob: Blob;
  /** Small (~240px) JPEG data URL — instant render, survives reload. */
  thumbnailDataUrl: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
}

/**
 * Compress and re-encode a captured photo for upload.
 * Resize to ≤1600px on the long edge, JPEG quality ~0.8, target ≤1MB.
 * Returns the compressed Blob plus an in-memory thumbnail for the UI.
 */
export async function compressForUpload(
  file: File,
): Promise<CompressedPhoto> {
  if (file.size > MAX_INPUT_FILE_BYTES) {
    throw new Error(
      "That image is unusually large — try a different photo.",
    );
  }

  const compressedFile = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.8,
  });

  const mimeType = "image/jpeg";
  const dims = await readImageDimensions(compressedFile);
  const thumbnailDataUrl = await makeThumbnail(compressedFile);

  return {
    blob: compressedFile,
    thumbnailDataUrl,
    mimeType,
    fileSize: compressedFile.size,
    width: dims?.width,
    height: dims?.height,
  };
}

async function readImageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number } | undefined> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(undefined);
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function makeThumbnail(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const scale = Math.min(
      1,
      THUMBNAIL_MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // Extremely unlikely on a modern browser; fall back to a tiny
      // text data URL rather than crashing capture.
      return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>";
    }
    ctx.drawImage(img, 0, 0, w, h);
    // JPEG quality 0.7 keeps the thumb under ~10KB at 240px.
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Couldn't read that image — try another."));
    img.src = src;
  });
}

/** Stable client-generated id for a photo row (matches the eventual
 *  Postgres photos.id). Mirrors the submissions.id convention. */
export function newPhotoId(): string {
  return crypto.randomUUID();
}
