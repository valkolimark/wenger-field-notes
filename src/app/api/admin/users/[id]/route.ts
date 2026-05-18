import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, submissions } from "@/lib/db/schema";
import { requireAdmin, type AdminUserDTO } from "@/lib/admin";

export const runtime = "nodejs";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

async function countFor(repId: string): Promise<number> {
  const r = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(submissions)
    .where(eq(submissions.repId, repId));
  return r[0]?.n ?? 0;
}

// PATCH /api/admin/users/[id] — edit a user (admin only).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.res;
    const { id } = await params;

    const target = (
      await db.select().from(users).where(eq(users.id, id))
    )[0];
    if (!target) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      );
    }
    const isSelf = target.repId === gate.repId;

    const body = (await req.json().catch(() => null)) as {
      email?: unknown;
      name?: unknown;
      repId?: unknown;
      role?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json(
        { error: "Couldn't update user — try again." },
        { status: 400 },
      );
    }

    const wantsEmail = typeof body.email === "string";
    const wantsName = typeof body.name === "string";
    const wantsRepId = typeof body.repId === "string";
    const wantsRole = typeof body.role === "string";
    if (!wantsEmail && !wantsName && !wantsRepId && !wantsRole) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 },
      );
    }

    const updates: Partial<typeof users.$inferInsert> = {};

    if (wantsName) {
      const name = (body.name as string).trim();
      if (!name) {
        return NextResponse.json(
          { error: "Name can't be empty." },
          { status: 400 },
        );
      }
      updates.name = name;
    }

    if (wantsRole) {
      const role = (body.role as string).trim();
      if (role !== "admin" && role !== "rep") {
        return NextResponse.json(
          { error: "Role must be admin or rep." },
          { status: 400 },
        );
      }
      if (isSelf && role !== target.role) {
        return NextResponse.json(
          { error: "You can't change your own role." },
          { status: 403 },
        );
      }
      updates.role = role;
    }

    if (wantsEmail) {
      const email = (body.email as string).trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json(
          { error: "That doesn't look like a valid email." },
          { status: 400 },
        );
      }
      if (email !== target.email) {
        const clash = (
          await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.email, email), ne(users.id, id)))
        )[0];
        if (clash) {
          return NextResponse.json(
            { error: "That email is already in use." },
            { status: 409 },
          );
        }
      }
      updates.email = email;
    }

    if (wantsRepId) {
      const repId = (body.repId as string).trim();
      if (!repId) {
        return NextResponse.json(
          { error: "Rep ID can't be empty." },
          { status: 400 },
        );
      }
      if (repId !== target.repId) {
        // GATE 1 decision (a): disallow repId change if the user has
        // submissions (reassignment is the explicit delete-flow path).
        const n = await countFor(target.repId);
        if (n > 0) {
          return NextResponse.json(
            {
              error: `Can't change rep ID — this user has ${n} submission(s). Reassign them via delete instead.`,
            },
            { status: 409 },
          );
        }
        const clash = (
          await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.repId, repId), ne(users.id, id)))
        )[0];
        if (clash) {
          return NextResponse.json(
            { error: "That rep ID is already in use." },
            { status: 409 },
          );
        }
        updates.repId = repId;
      }
    }

    const updated = (
      await db.update(users).set(updates).where(eq(users.id, id)).returning()
    )[0];

    const dto: AdminUserDTO = {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      repId: updated.repId,
      role: updated.role,
      passwordSet: updated.passwordUpdatedAt !== null,
      submissionCount: await countFor(updated.repId),
    };
    return NextResponse.json({ user: dto });
  } catch (err) {
    console.error("PATCH /api/admin/users/[id] failed:", err);
    return NextResponse.json(
      { error: "Couldn't update user — please try again." },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/users/[id] — safe delete with mandatory submission
// handling (GATE 2). neon-http has no interactive transactions; db.batch
// runs the mutations atomically (single server-side transaction).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.res;
    const { id } = await params;

    const target = (
      await db.select().from(users).where(eq(users.id, id))
    )[0];
    if (!target) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      );
    }
    if (target.repId === gate.repId) {
      return NextResponse.json(
        { error: "You can't delete your own account." },
        { status: 403 },
      );
    }

    const n = await countFor(target.repId);

    if (n === 0) {
      await db.delete(users).where(eq(users.id, id));
      return NextResponse.json({ deleted: true });
    }

    const body = (await req.json().catch(() => ({}))) as {
      reassignTo?: unknown;
      deleteSubmissions?: unknown;
    };
    const reassignTo =
      typeof body.reassignTo === "string" ? body.reassignTo.trim() : "";
    const deleteSubmissions = body.deleteSubmissions === true;

    if (!reassignTo && !deleteSubmissions) {
      return NextResponse.json(
        {
          error: `This user has ${n} submission(s) — choose reassign or delete.`,
        },
        { status: 400 },
      );
    }
    if (reassignTo && deleteSubmissions) {
      return NextResponse.json(
        { error: "Choose either reassign or delete, not both." },
        { status: 400 },
      );
    }

    if (deleteSubmissions) {
      await db.batch([
        db.delete(submissions).where(eq(submissions.repId, target.repId)),
        db.delete(users).where(eq(users.id, id)),
      ]);
      return NextResponse.json({ deleted: true, deletedSubmissions: n });
    }

    const dest = (
      await db.select().from(users).where(eq(users.repId, reassignTo))
    )[0];
    if (!dest || dest.id === target.id) {
      return NextResponse.json(
        { error: "Reassignment target not found." },
        { status: 400 },
      );
    }

    await db.batch([
      db
        .update(submissions)
        .set({ repId: dest.repId, repName: dest.name ?? dest.repId })
        .where(eq(submissions.repId, target.repId)),
      db.delete(users).where(eq(users.id, id)),
    ]);
    return NextResponse.json({
      deleted: true,
      reassignedCount: n,
      reassignedTo: dest.repId,
    });
  } catch (err) {
    console.error("DELETE /api/admin/users/[id] failed:", err);
    return NextResponse.json(
      { error: "Couldn't delete user — please try again." },
      { status: 500 },
    );
  }
}
