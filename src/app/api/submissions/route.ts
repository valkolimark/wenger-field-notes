import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { submissions, type InsertSubmission } from "@/lib/db/schema";
import type { Submission } from "@/lib/submissions";

export const runtime = "nodejs";

// POST /api/submissions — body is a full Cycle 4 Submission.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Submission>;

    const missing: string[] = [];
    if (!body.id) missing.push("id");
    if (!body.schoolId) missing.push("schoolId");
    if (!body.schoolName) missing.push("schoolName");
    if (!body.repId) missing.push("repId");
    if (!body.repName) missing.push("repName");
    if (!body.visitDate) missing.push("visitDate");
    if (!body.priority?.visitPriority) missing.push("priority.visitPriority");
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Couldn't save this visit — missing ${missing.join(", ")}.`,
        },
        { status: 400 },
      );
    }

    const visitDate = new Date(body.visitDate as string);
    if (Number.isNaN(visitDate.getTime())) {
      return NextResponse.json(
        { error: "Couldn't save this visit — the visit date is invalid." },
        { status: 400 },
      );
    }

    const values: InsertSubmission = {
      id: body.id!,
      schoolId: body.schoolId!,
      schoolName: body.schoolName!,
      repId: body.repId!,
      repName: body.repName!,
      visitDate,
      priority: body.priority!,
      contact: body.contact!,
      purchasing: body.purchasing!,
      decisionMaking: body.decisionMaking!,
      marketing: body.marketing!,
      notes: body.notes ?? "",
    };

    // Idempotent on id so the one-time legacy backfill can safely retry.
    const inserted = await db
      .insert(submissions)
      .values(values)
      .onConflictDoNothing({ target: submissions.id })
      .returning();

    const row =
      inserted[0] ??
      (
        await db
          .select()
          .from(submissions)
          .where(eq(submissions.id, values.id))
      )[0];

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("POST /api/submissions failed:", err);
    return NextResponse.json(
      { error: "Couldn't save your visit — please try again." },
      { status: 500 },
    );
  }
}

// GET /api/submissions?repId=… — this rep's submissions, newest first.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // TODO(cycle-6): replace with session.user — don't trust the query param.
    const repId = searchParams.get("repId");
    if (!repId) {
      return NextResponse.json(
        { error: "Missing repId." },
        { status: 400 },
      );
    }

    const rows = await db
      .select()
      .from(submissions)
      .where(eq(submissions.repId, repId))
      .orderBy(desc(submissions.visitDate), desc(submissions.createdAt));

    return NextResponse.json({ submissions: rows });
  } catch (err) {
    console.error("GET /api/submissions failed:", err);
    return NextResponse.json(
      { error: "Couldn't load submissions — please try again." },
      { status: 500 },
    );
  }
}
