import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// POST /api/admin/users/[id]/reset-password — reset to bootstrap; the
// target is forced to change on next login. (admin only)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.res;
    const { id } = await params;

    const seed = process.env.SEED_PASSWORD;
    if (!seed) {
      console.error("reset-password: SEED_PASSWORD not set");
      return NextResponse.json(
        { error: "Couldn't reset password — server is misconfigured." },
        { status: 500 },
      );
    }

    const target = (
      await db.select({ id: users.id }).from(users).where(eq(users.id, id))
    )[0];
    if (!target) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      );
    }

    const passwordHash = await bcrypt.hash(seed, 10);
    await db
      .update(users)
      .set({ passwordHash, passwordUpdatedAt: null })
      .where(eq(users.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/users/[id]/reset-password failed:", err);
    return NextResponse.json(
      { error: "Couldn't reset password — please try again." },
      { status: 500 },
    );
  }
}
