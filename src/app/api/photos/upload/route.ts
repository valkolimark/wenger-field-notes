import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/lib/db/client";
import { photos } from "@/lib/db/schema";
import { authorizeForSubmission } from "@/lib/submission-auth";

export const runtime = "nodejs";

// Cycle 13: direct client upload to Vercel Blob. Flow per Q1 gate
// (option A, Recommended):
//   1. Client (sync engine) calls `@vercel/blob/client.upload(...)`
//      which POSTs `{ type: 'blob.generate-client-token', payload }`
//      to this route.
//   2. `onBeforeGenerateToken` authorizes (session + submission
//      ownership), then returns the token config including the
//      `tokenPayload` we'll see again in the completion callback.
//   3. Client uploads bytes directly to Vercel Blob using the
//      issued token (file bytes never touch this function).
//   4. Vercel Blob calls this route back server-to-server with
//      `{ type: 'blob.upload-completed', payload }`.
//   5. `onUploadCompleted` inserts the photos row with the trusted
//      values from the tokenPayload + the blob URL/pathname.
//
// Identity is session-derived (Cycle 6.5 lesson): rep/admin gates
// come from `authorizeForSubmission` against the parent submission
// row, not anything sent by the client.

// Maximum bytes we accept per photo. The client compresses to ~1MB
// per <browser-image-compression> config; cap at 4MB as a defensive
// upper bound (a single ~12MP JPEG at q=1 is well under this).
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

interface ClientPayload {
  photoId: string;
  submissionId: string;
  caption?: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  takenAt: string;
}

interface TrustedPayload extends ClientPayload {
  repId: string;
  schoolId: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    const result = await handleUpload({
      request: req,
      body,
      // ------- token generation: validate + authorize ----------------
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const parsed = parseClientPayload(clientPayload);
        if (!parsed) {
          throw new Error("Missing or invalid clientPayload.");
        }
        if (!pathnameMatchesSubmission(pathname, parsed.submissionId)) {
          // Pathname is client-suggested; the server enforces the
          // expected `photos/<submissionId>/...` shape so a rep can't
          // collide with another rep's blob namespace.
          throw new Error("Pathname does not match submissionId.");
        }

        const gate = await authorizeForSubmission(parsed.submissionId);
        if (!gate.ok) {
          // Throwing here returns a 4xx from handleUpload; the client
          // sees an error and the sync engine flips the photo to
          // 'failed' on retry exhaustion.
          throw new Error(
            gate.res.status === 401
              ? "Not signed in."
              : gate.res.status === 404
                ? "Parent submission not found."
                : "Forbidden.",
          );
        }

        // tokenPayload is sent back to us in onUploadCompleted; we
        // pack the trusted server-side values so the callback never
        // trusts new data from the client mid-flow.
        const trusted: TrustedPayload = {
          ...parsed,
          repId: gate.row.repId,
          schoolId: gate.row.schoolId,
        };

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
          ],
          maximumSizeInBytes: MAX_PHOTO_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(trusted),
        };
      },
      // ------- completion callback: write the photos row ------------
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) {
          console.error("photos/upload: completion without tokenPayload");
          return;
        }
        let trusted: TrustedPayload;
        try {
          trusted = JSON.parse(tokenPayload) as TrustedPayload;
        } catch (err) {
          console.error(
            "photos/upload: bad tokenPayload JSON",
            err,
          );
          return;
        }

        try {
          await db
            .insert(photos)
            .values({
              id: trusted.photoId,
              submissionId: trusted.submissionId,
              repId: trusted.repId,
              schoolId: trusted.schoolId,
              blobUrl: blob.url,
              blobPathname: blob.pathname,
              caption: trusted.caption ?? "",
              mimeType: trusted.mimeType,
              fileSize: trusted.fileSize,
              width: trusted.width ?? null,
              height: trusted.height ?? null,
              takenAt: new Date(trusted.takenAt),
            })
            .onConflictDoNothing({ target: photos.id });
        } catch (err) {
          // Vercel Blob retries this callback on failure; logging is
          // enough — the next retry succeeds or fails idempotently.
          console.error(
            "photos/upload: insert failed",
            (err as Error)?.message,
          );
          throw err;
        }
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = (err as Error)?.message ?? "Upload failed.";
    console.error("POST /api/photos/upload:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

function parseClientPayload(raw: string | null): ClientPayload | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<ClientPayload>;
    if (
      typeof obj.photoId !== "string" ||
      typeof obj.submissionId !== "string" ||
      typeof obj.mimeType !== "string" ||
      typeof obj.fileSize !== "number" ||
      typeof obj.takenAt !== "string"
    ) {
      return null;
    }
    return {
      photoId: obj.photoId,
      submissionId: obj.submissionId,
      caption: typeof obj.caption === "string" ? obj.caption : "",
      mimeType: obj.mimeType,
      fileSize: obj.fileSize,
      width: typeof obj.width === "number" ? obj.width : undefined,
      height: typeof obj.height === "number" ? obj.height : undefined,
      takenAt: obj.takenAt,
    };
  } catch {
    return null;
  }
}

function pathnameMatchesSubmission(
  pathname: string,
  submissionId: string,
): boolean {
  // Expect `photos/{submissionId}/{anything}` (random suffix permitted).
  return pathname.startsWith(`photos/${submissionId}/`);
}
