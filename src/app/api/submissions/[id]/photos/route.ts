import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { photos } from "@/lib/db/schema";
import { authorizeForSubmission } from "@/lib/submission-auth";

export const runtime = "nodejs";

// Cycle 13: list non-deleted photos for a single submission.
// Owner-or-admin gated through the parent submission row (same matrix
// the per-submission edit/delete uses). Returns a thin DTO — no
// blob_url is exposed to the client; thumbnails/lightbox fetch the
// bytes through /api/photos/[id]/file (the private-blob proxy).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const gate = await authorizeForSubmission(id);
    if (!gate.ok) return gate.res;

    const rows = await db
      .select({
        id: photos.id,
        submissionId: photos.submissionId,
        caption: photos.caption,
        mimeType: photos.mimeType,
        fileSize: photos.fileSize,
        width: photos.width,
        height: photos.height,
        takenAt: photos.takenAt,
        uploadedAt: photos.uploadedAt,
      })
      .from(photos)
      .where(
        and(eq(photos.submissionId, id), isNull(photos.deletedAt)),
      )
      .orderBy(asc(photos.takenAt));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/submissions/[id]/photos failed:", err);
    return NextResponse.json(
      { error: "Couldn't load photos — please try again." },
      { status: 500 },
    );
  }
}
