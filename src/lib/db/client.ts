import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Pooled connection (DATABASE_URL host contains "-pooler") — correct for
// short-lived serverless API route invocations.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Run `vercel env pull .env.local` (Neon Marketplace integration).",
  );
}

const sql = neon(url);
export const db = drizzle(sql, { schema });
