// Cycle 6 one-time seed: insert the allowlist roster into `users` with a
// single bcrypt hash of SEED_PASSWORD (cost 10). Idempotent — on email
// conflict, do nothing. password_updated_at = NULL forces a change on
// first login.
//
// Run locally (SEED_PASSWORD is never committed):
//   SEED_PASSWORD='…' npm run db:seed
import { config } from "dotenv";
config({ path: ".env.local" }); // DATABASE_URL; SEED_PASSWORD comes from inline env

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";
import * as schema from "../src/lib/db/schema";
import { allowlist } from "../src/lib/allowlist";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (.env.local).");
  const seedPw = process.env.SEED_PASSWORD;
  if (!seedPw) {
    throw new Error(
      "SEED_PASSWORD is not set. Pass it inline; never commit it.",
    );
  }

  const db = drizzle(neon(url), { schema });
  const passwordHash = await bcrypt.hash(seedPw, 10);

  for (const u of allowlist) {
    await db
      .insert(schema.users)
      .values({
        email: u.email.toLowerCase(),
        name: u.name,
        passwordHash,
        repId: u.repId,
        role: u.role,
        passwordUpdatedAt: null,
      })
      .onConflictDoNothing({ target: schema.users.email });
  }

  const rows = await db
    .select({
      email: schema.users.email,
      repId: schema.users.repId,
      role: schema.users.role,
    })
    .from(schema.users);
  console.log(`Seed complete. users rows: ${rows.length}`);
  for (const r of rows.sort((a, b) => a.email.localeCompare(b.email))) {
    console.log(`  ${r.email}  ${r.repId}  ${r.role}`);
  }
}

main().catch((e) => {
  console.error("seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
