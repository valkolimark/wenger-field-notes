import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import type { Role } from "@/lib/allowlist";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const row = (
          await db.select().from(users).where(eq(users.email, email))
        )[0];
        if (!row) return null;

        const ok = await bcrypt.compare(password, row.passwordHash);
        if (!ok) return null;

        return {
          id: row.id,
          email: row.email,
          name: row.name ?? null,
          repId: row.repId,
          role: row.role as Role,
          // NULL password_updated_at => bootstrap password still in use.
          mustChangePassword: row.passwordUpdatedAt === null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.repId = user.repId;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        // next-auth/jwt augmentation is flaky under the beta; token claims
        // read back as `unknown`, so assert the shapes we set in `jwt`.
        session.user.repId = token.repId as string;
        session.user.role = token.role as Role;
        session.user.mustChangePassword =
          token.mustChangePassword as boolean;
      }
      return session;
    },
  },
});
