import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { submissions } from "@/lib/db/schema";

export const runtime = "nodejs";

// GET /api/submissions/[id] — single submission by id.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const row = (
      await db.select().from(submissions).where(eq(submissions.id, id))
    )[0];

    // TODO(cycle-6): 403 if row.repId !== session.user id (no rep filter yet).
    if (!row) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(row);
  } catch (err) {
    console.error("GET /api/submissions/[id] failed:", err);
    return NextResponse.json(
      { error: "Couldn't load this submission — please try again." },
      { status: 500 },
    );
  }
}
