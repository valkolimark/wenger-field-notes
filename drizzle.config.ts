import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit is a CLI (not Next.js) so it won't auto-load .env.local.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
