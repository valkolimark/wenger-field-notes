import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { submissions } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { submissionsToCsv } from "@/lib/csv";

export const runtime = "nodejs";

// GET /api/admin/submissions/export.csv[?repId=] — CSV download (admin).
export async function GET(req: Request) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.res;

    const repId = new URL(req.url).searchParams.get("repId");
    const order = [
      desc(submissions.visitDate),
      desc(submissions.createdAt),
    ] as const;

    const rows = repId
      ? await db
          .select()
          .from(submissions)
          .where(eq(submissions.repId, repId))
          .orderBy(...order)
      : await db.select().from(submissions).orderBy(...order);

    const csv = submissionsToCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="submissions-${stamp}.csv"`,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/submissions/export.csv failed:", err);
    return NextResponse.json(
      { error: "Couldn't export submissions — please try again." },
      { status: 500 },
    );
  }
}
