import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { submissions } from "@/lib/db/schema";

export const runtime = "nodejs";

// GET /api/submissions/[id] — owner or admin only (Cycle 6: resolves the
// Cycle 5 server-trust / session-mismatch TODO).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { id } = await params;
    const row = (
      await db.select().from(submissions).where(eq(submissions.id, id))
    )[0];

    if (!row) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    if (
      session.user.role !== "admin" &&
      row.repId !== session.user.repId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
