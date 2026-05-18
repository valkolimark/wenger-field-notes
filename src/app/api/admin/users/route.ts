import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db/client";
import { users, submissions } from "@/lib/db/schema";
import { requireAdmin, type AdminUserDTO } from "@/lib/admin";

export const runtime = "nodejs";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

async function submissionCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      repId: submissions.repId,
      n: sql<number>`count(*)::int`,
    })
    .from(submissions)
    .groupBy(submissions.repId);
  return new Map(rows.map((r) => [r.repId, r.n]));
}

// GET /api/admin/users — all users (no password hashes, ever).
export async function GET() {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.res;

    const [rows, counts] = await Promise.all([
      db.select().from(users),
      submissionCounts(),
    ]);
    const dto: AdminUserDTO[] = rows
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        repId: u.repId,
        role: u.role,
        passwordSet: u.passwordUpdatedAt !== null,
        submissionCount: counts.get(u.repId) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.role.localeCompare(a.role) || a.email.localeCompare(b.email),
      );

    return NextResponse.json({ users: dto });
  } catch (err) {
    console.error("GET /api/admin/users failed:", err);
    return NextResponse.json(
      { error: "Couldn't load users — please try again." },
      { status: 500 },
    );
  }
}

// POST /api/admin/users — add a user in bootstrap state.
export async function POST(req: Request) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.res;

    const seed = process.env.SEED_PASSWORD;
    if (!seed) {
      console.error("POST /api/admin/users: SEED_PASSWORD not set");
      return NextResponse.json(
        { error: "Couldn't add user — server is misconfigured." },
        { status: 500 },
      );
    }

    const body = (await req.json().catch(() => null)) as {
      email?: unknown;
      name?: unknown;
      repId?: unknown;
      role?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json(
        { error: "Couldn't add user — try again." },
        { status: 400 },
      );
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const repId = String(body.repId ?? "").trim();
    const role = String(body.role ?? "").trim();

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "That doesn't look like a valid email." },
        { status: 400 },
      );
    }
    if (!name) {
      return NextResponse.json(
        { error: "Name can't be empty." },
        { status: 400 },
      );
    }
    if (!repId) {
      return NextResponse.json(
        { error: "Rep ID can't be empty." },
        { status: 400 },
      );
    }
    if (role !== "admin" && role !== "rep") {
      return NextResponse.json(
        { error: "Role must be admin or rep." },
        { status: 400 },
      );
    }

    const clash = await db
      .select({ id: users.id, email: users.email, repId: users.repId })
      .from(users)
      .where(sql`${users.email} = ${email} OR ${users.repId} = ${repId}`);
    if (clash.some((c) => c.email === email)) {
      return NextResponse.json(
        { error: "That email is already in use." },
        { status: 409 },
      );
    }
    if (clash.some((c) => c.repId === repId)) {
      return NextResponse.json(
        { error: "That rep ID is already in use." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(seed, 10);
    const inserted = (
      await db
        .insert(users)
        .values({
          email,
          name,
          repId,
          role,
          passwordHash,
          passwordUpdatedAt: null,
        })
        .returning()
    )[0];

    const dto: AdminUserDTO = {
      id: inserted.id,
      email: inserted.email,
      name: inserted.name,
      repId: inserted.repId,
      role: inserted.role,
      passwordSet: false,
      submissionCount: 0,
    };
    return NextResponse.json({ user: dto }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/users failed:", err);
    return NextResponse.json(
      { error: "Couldn't add user — please try again." },
      { status: 500 },
    );
  }
}
