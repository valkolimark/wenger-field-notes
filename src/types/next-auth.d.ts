import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/allowlist";

declare module "next-auth" {
  interface Session {
    user: {
      repId: string;
      role: Role;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    repId: string;
    role: Role;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    repId: string;
    role: Role;
    mustChangePassword: boolean;
  }
}
