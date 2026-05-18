import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSubmissions } from "@/lib/submissions-query";

export const runtime = "nodejs";

// GET /api/admin/submissions[?repId=] — all submissions (admin only).
export async function GET(req: Request) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.res;

    const repId = new URL(req.url).searchParams.get("repId") || undefined;
    const rows = await getSubmissions(repId);
    return NextResponse.json({ submissions: rows });
  } catch (err) {
    console.error("GET /api/admin/submissions failed:", err);
    return NextResponse.json(
      { error: "Couldn't load submissions — please try again." },
      { status: 500 },
    );
  }
}
