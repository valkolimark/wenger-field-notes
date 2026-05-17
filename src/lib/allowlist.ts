// Cycle 6: seed source of truth for who may log in. Users are seeded
// into the Neon `users` table from this list (see scripts/seed-users.ts).
// Auth at runtime queries the `users` table, not this file.
//
// Emails are stored/compared LOWERCASE everywhere (seed, login lookup).

export type Role = "admin" | "rep";

export interface AllowlistEntry {
  email: string; // lowercase
  name: string;
  repId: string;
  role: Role;
}

export const allowlist: AllowlistEntry[] = [
  {
    email: "jackie.berg@wengercorp.com",
    name: "Jackie Berg",
    repId: "JBerg",
    role: "admin",
  },
  {
    email: "mark.mireles@wengercorp.com",
    name: "Mark Mireles",
    repId: "MMireles",
    role: "admin",
  },
  {
    email: "brooke.hrdlichka@wengercorp.com",
    name: "Brooke Hrdlichka",
    repId: "BHrdlichka",
    role: "rep",
  },
  {
    email: "tam.trutwin@wengercorp.com",
    name: "Tam Trutwin",
    repId: "TTrutwin",
    role: "rep",
  },
  {
    email: "chad.parrish@wengercorp.com",
    name: "Chad Parrish",
    repId: "CParrish",
    role: "rep",
  },
  {
    email: "linda.leng@wengercorp.com",
    name: "Linda Leng",
    repId: "LLeng",
    role: "rep",
  },
  {
    email: "rakhi.malik@wengercorp.com",
    name: "Rakhi Malik",
    repId: "RMalik",
    role: "rep",
  },
];
