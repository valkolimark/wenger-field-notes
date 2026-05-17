import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users, type InsertUser } from "@/lib/db/schema";

export const runtime = "nodejs";

type Body = {
  name?: unknown;
  email?: unknown;
  currentPassword?: unknown;
  newPassword?: unknown;
};

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Self-service profile edit. The target user is derived ONLY from the
// session — any identity fields in the body are ignored.
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    const sessionEmail = session?.user?.email?.toLowerCase();
    if (!sessionEmail) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json(
        { error: "Couldn't update your profile — try again." },
        { status: 400 },
      );
    }
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Couldn't update your profile — try again." },
        { status: 400 },
      );
    }

    const wantsName = typeof body.name === "string";
    const wantsEmail = typeof body.email === "string";
    const wantsPassword = typeof body.newPassword === "string";
    if (!wantsName && !wantsEmail && !wantsPassword) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 },
      );
    }

    const me = (
      await db.select().from(users).where(eq(users.email, sessionEmail))
    )[0];
    if (!me) {
      return NextResponse.json(
        { error: "Account not found — please sign in again." },
        { status: 404 },
      );
    }

    const updates: Partial<InsertUser> = {};

    if (wantsName) {
      const name = (body.name as string).trim();
      if (!name) {
        return NextResponse.json(
          { error: "Name can't be empty." },
          { status: 400 },
        );
      }
      if (name.length > 120) {
        return NextResponse.json(
          { error: "That name is too long." },
          { status: 400 },
        );
      }
      updates.name = name;
    }

    if (wantsEmail) {
      const email = (body.email as string).trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json(
          { error: "That doesn't look like a valid email." },
          { status: 400 },
        );
      }
      if (email !== me.email) {
        const clash = (
          await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.email, email), ne(users.id, me.id)))
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

    if (wantsPassword) {
      const currentPassword =
        typeof body.currentPassword === "string"
          ? body.currentPassword
          : "";
      const newPassword = body.newPassword as string;
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Enter your current password to change it." },
          { status: 400 },
        );
      }
      const ok = await bcrypt.compare(currentPassword, me.passwordHash);
      if (!ok) {
        return NextResponse.json(
          { error: "Your current password is incorrect." },
          { status: 400 },
        );
      }
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters." },
          { status: 400 },
        );
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 10);
      updates.passwordUpdatedAt = new Date();
    }

    const updated = (
      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, me.id))
        .returning()
    )[0];

    return NextResponse.json({
      name: updated.name,
      email: updated.email,
      repId: updated.repId,
      role: updated.role,
    });
  } catch (err) {
    console.error("PATCH /api/account failed:", err);
    return NextResponse.json(
      { error: "Couldn't update your profile — try again." },
      { status: 500 },
    );
  }
}
