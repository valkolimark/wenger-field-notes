import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { submissions } from "@/lib/db/schema";
import type { Submission } from "@/lib/submissions";
import { authorizeForSubmission } from "@/lib/submission-auth";

export const runtime = "nodejs";

// Owner-or-admin gate moved to lib/submission-auth.ts (Cycle 13) so
// the photo routes can share it. Behavior unchanged: 401 → 404 → 403,
// session-derived repId never trusted from the request body.

// GET /api/submissions/[id] — owner or admin only.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const gate = await authorizeForSubmission(id);
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
    const gate = await authorizeForSubmission(id);
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
    const gate = await authorizeForSubmission(id);
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
