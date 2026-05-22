-- Cycle 18 (Brooke's visit-form redesign).
-- Destructive migration — Cycle 14 precedent: dev data, wipe-and-reseed
-- under explicit user authorization at the cycle's proceed gate.
--
-- The `priority` and `decision_making` jsonb columns are dropped
-- (those blocks are gone from the new form). A new `projects_needs`
-- jsonb column carries upcomingProjects, currentNeeds, and the
-- single-select timeline. The `contact`/`purchasing`/`marketing`
-- columns stay as jsonb at the SQL level (their TS sub-types changed
-- via Drizzle's $type<>, but the column types are unchanged).
-- A separate wipe (handled by scripts/cycle18-wipe-submissions.ts)
-- clears `submissions` + `photos` so the leftover jsonb in the
-- recoded columns doesn't get deserialized against the new types.

ALTER TABLE "submissions" DROP COLUMN IF EXISTS "priority";
ALTER TABLE "submissions" DROP COLUMN IF EXISTS "decision_making";
ALTER TABLE "submissions" ADD COLUMN "projects_needs" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "submissions" ALTER COLUMN "projects_needs" DROP DEFAULT;
