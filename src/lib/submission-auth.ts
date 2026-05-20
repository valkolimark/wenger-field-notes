import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { submissions, type SubmissionRow } from "@/lib/db/schema";

// Owner-or-admin gate for a single submission. Extracted from
// /api/submissions/[id]/route.ts (Cycle 10) so the Cycle 13 photo
// routes (upload / list / delete / proxy) can apply the same rules
// without duplicating the matrix.
//
// Identity is session-derived via repId (Cycle 6.5 lesson: JWT email
// can go stale after an email change). Order: 401 → 404 → 403.
export async function authorizeForSubmission(
  id: string,
): Promise<
  | {
      ok: true;
      row: SubmissionRow;
      isAdmin: boolean;
      repId: string;
    }
  | { ok: false; res: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.repId) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }

  const row = (
    await db.select().from(submissions).where(eq(submissions.id, id))
  )[0];
  if (!row) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      ),
    };
  }

  const isAdmin = session.user.role === "admin";
  if (!isAdmin && row.repId !== session.user.repId) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, row, isAdmin, repId: session.user.repId };
}
