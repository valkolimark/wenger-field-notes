import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/allowlist";

// Per-route admin gate (defense in depth — middleware is the first line).
// Identity is session-derived via repId (Cycle 6.5 lesson: JWT email
// goes stale after an email change).
export async function requireAdmin(): Promise<
  | { ok: true; repId: string; role: Role }
  | { ok: false; res: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.repId) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  if (session.user.role !== "admin") {
    return {
      ok: false,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, repId: session.user.repId, role: session.user.role };
}

export interface AdminUserDTO {
  id: string;
  email: string;
  name: string | null;
  repId: string;
  role: string;
  passwordSet: boolean;
  submissionCount: number;
}
