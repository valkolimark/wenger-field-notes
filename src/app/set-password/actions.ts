"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { auth, signIn } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export async function setPassword(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect("/");

  const pw = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (pw !== confirm) return "Passwords don't match.";

  const passwordHash = await bcrypt.hash(pw, 10);
  await db
    .update(users)
    .set({ passwordHash, passwordUpdatedAt: new Date() })
    .where(eq(users.email, email));

  // Re-issue the JWT so mustChangePassword flips to false, then enter app.
  await signIn("credentials", { email, password: pw, redirect: false });
  redirect("/map");
}
