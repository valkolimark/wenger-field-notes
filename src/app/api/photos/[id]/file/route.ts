import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { db } from "@/lib/db/client";
import { photos } from "@/lib/db/schema";
import { authorizeForSubmission } from "@/lib/submission-auth";

export const runtime = "nodejs";

// Cycle 13 architecture amendment (Q4): the Vercel Blob store is
// private. Browser reads (thumbnails + lightbox) route through this
// proxy. We re-check owner-or-admin against the parent submission,
// then stream the bytes from Vercel Blob using the read-write token.
//
// Cache-Control: private, max-age=3600 lets the rep's browser hold
// onto the bytes for an hour without re-fetching, while staying out
// of any shared cache. Soft-deleted photos 404 even if the row still
// exists.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const row = (
      await db
        .select({
          submissionId: photos.submissionId,
          blobUrl: photos.blobUrl,
          mimeType: photos.mimeType,
          deletedAt: photos.deletedAt,
        })
        .from(photos)
        .where(eq(photos.id, id))
    )[0];
    if (!row || row.deletedAt) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 },
      );
    }

    const gate = await authorizeForSubmission(row.submissionId);
    if (!gate.ok) return gate.res;

    const result = await get(row.blobUrl, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      console.error(
        "photos/[id]/file: blob fetch returned",
        result?.statusCode,
      );
      return NextResponse.json(
        { error: "Photo unavailable." },
        { status: 502 },
      );
    }

    return new Response(result.stream, {
      status: 200,
      headers: {
        "Content-Type": row.mimeType || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("GET /api/photos/[id]/file failed:", err);
    return NextResponse.json(
      { error: "Couldn't load photo — please try again." },
      { status: 500 },
    );
  }
}
