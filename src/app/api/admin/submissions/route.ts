import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { submissions } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// GET /api/admin/submissions[?repId=] — all submissions (admin only).
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

    return NextResponse.json({ submissions: rows });
  } catch (err) {
    console.error("GET /api/admin/submissions failed:", err);
    return NextResponse.json(
      { error: "Couldn't load submissions — please try again." },
      { status: 500 },
    );
  }
}
