import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { photos } from "@/lib/db/schema";
import { authorizeForSubmission } from "@/lib/submission-auth";

export const runtime = "nodejs";

// Cycle 13: DELETE /api/photos/[id] — soft-delete (Q2 gate).
// Owner-or-admin gated via the parent submission. We do NOT delete
// the bytes from Vercel Blob here; a future cleanup pass will reap
// orphans. Keeps the row delete from racing a flaky blob delete
// (the row vanishes only if we're sure the blob is also gone).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const row = (
      await db
        .select({ submissionId: photos.submissionId, deletedAt: photos.deletedAt })
        .from(photos)
        .where(eq(photos.id, id))
    )[0];
    if (!row) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 },
      );
    }
    // Already soft-deleted: treat as 404 so the rep doesn't see a
    // stale row reappear.
    if (row.deletedAt) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 },
      );
    }

    const gate = await authorizeForSubmission(row.submissionId);
    if (!gate.ok) return gate.res;

    await db
      .update(photos)
      .set({ deletedAt: new Date() })
      .where(and(eq(photos.id, id), isNull(photos.deletedAt)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/photos/[id] failed:", err);
    return NextResponse.json(
      { error: "Couldn't delete this photo — please try again." },
      { status: 500 },
    );
  }
}
