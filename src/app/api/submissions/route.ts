import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { submissions, type InsertSubmission } from "@/lib/db/schema";
import type { Submission } from "@/lib/submissions";

export const runtime = "nodejs";

// POST /api/submissions — rep identity comes from the session, never the
// client body (Cycle 6: resolves the Cycle 5 server-trust TODO).
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const body = (await req.json()) as Partial<Submission>;
    const missing: string[] = [];
    if (!body.id) missing.push("id");
    if (!body.schoolId) missing.push("schoolId");
    if (!body.schoolName) missing.push("schoolName");
    if (!body.visitDate) missing.push("visitDate");
    if (!body.priority?.visitPriority) missing.push("priority.visitPriority");
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Couldn't save this visit — missing ${missing.join(", ")}.` },
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
      repId: session.user.repId,
      repName:
        session.user.name ?? session.user.email ?? session.user.repId,
      visitDate,
      priority: body.priority!,
      contact: body.contact!,
      purchasing: body.purchasing!,
      decisionMaking: body.decisionMaking!,
      marketing: body.marketing!,
      notes: body.notes ?? "",
    };

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

// GET /api/submissions — reps see their own; admins see all.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const base = db
      .select()
      .from(submissions)
      .orderBy(desc(submissions.visitDate), desc(submissions.createdAt));

    const rows =
      session.user.role === "admin"
        ? await base
        : await db
            .select()
            .from(submissions)
            .where(eq(submissions.repId, session.user.repId))
            .orderBy(
              desc(submissions.visitDate),
              desc(submissions.createdAt),
            );

    return NextResponse.json({ submissions: rows });
  } catch (err) {
    console.error("GET /api/submissions failed:", err);
    return NextResponse.json(
      { error: "Couldn't load submissions — please try again." },
      { status: 500 },
    );
  }
}
