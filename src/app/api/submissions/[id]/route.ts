import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { submissions, type SubmissionRow } from "@/lib/db/schema";
import type { Submission } from "@/lib/submissions";

export const runtime = "nodejs";

// Owner-or-admin gate for a single submission (defense in depth, same
// pattern as requireAdmin()). Reps act only on their own rows by session
// repId; admins on any. Identity is session-derived — never the request
// body/email (Cycle 6.5 lesson). Order matches the Cycle 6 GET:
// 401 not signed in → 404 missing → 403 not owner / not admin.
async function authorizeForRow(
  id: string,
): Promise<
  | { ok: true; row: SubmissionRow; isAdmin: boolean }
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

  return { ok: true, row, isAdmin };
}

// GET /api/submissions/[id] — owner or admin only.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const gate = await authorizeForRow(id);
    if (!gate.ok) return gate.res;
    return NextResponse.json(gate.row);
  } catch (err) {
    console.error("GET /api/submissions/[id] failed:", err);
    return NextResponse.json(
      { error: "Couldn't load this submission — please try again." },
      { status: 500 },
    );
  }
}

// PATCH /api/submissions/[id] — owner or admin edits the visit content.
// Body is validated the same way POST /api/submissions is. Identity
// (id / repId / repName / schoolId / schoolName) is immutable here, so an
// admin editing another rep's row never reassigns its ownership.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const gate = await authorizeForRow(id);
    if (!gate.ok) return gate.res;

    const body = (await req.json()) as Partial<Submission>;
    if (!body.priority?.visitPriority) {
      return NextResponse.json(
        {
          error:
            "Couldn't save this visit — missing priority.visitPriority.",
        },
        { status: 400 },
      );
    }

    // The visit form has no date control, so it round-trips the original
    // logged date; only overwrite visitDate if a valid one is supplied.
    let visitDate = gate.row.visitDate;
    if (body.visitDate != null) {
      const d = new Date(body.visitDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          {
            error:
              "Couldn't save this visit — the visit date is invalid.",
          },
          { status: 400 },
        );
      }
      visitDate = d;
    }

    const updated = await db
      .update(submissions)
      .set({
        priority: body.priority!,
        contact: body.contact!,
        purchasing: body.purchasing!,
        decisionMaking: body.decisionMaking!,
        marketing: body.marketing!,
        notes: body.notes ?? "",
        visitDate,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (err) {
    console.error("PATCH /api/submissions/[id] failed:", err);
    return NextResponse.json(
      { error: "Couldn't save your changes — please try again." },
      { status: 500 },
    );
  }
}

// DELETE /api/submissions/[id] — owner or admin. A single-row delete is
// atomic on its own (db.batch is only needed for multi-statement
// atomicity like the Cycle 7 user-delete-with-reassignment flow).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const gate = await authorizeForRow(id);
    if (!gate.ok) return gate.res;

    await db.delete(submissions).where(eq(submissions.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/submissions/[id] failed:", err);
    return NextResponse.json(
      { error: "Couldn't delete this submission — please try again." },
      { status: 500 },
    );
  }
}
