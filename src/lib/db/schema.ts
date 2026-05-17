import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uuid,
} from "drizzle-orm/pg-core";
import type { VisitFormData } from "@/lib/submissions";

// The 5 sectioned blocks are jsonb typed against the Cycle 4 form
// sub-types — the shape is owned by src/lib/submissions.ts, so adding a
// form field never requires a schema migration. (Per-field SQL filtering
// isn't needed until Cycle 7.)
export const submissions = pgTable(
  "submissions",
  {
    id: text("id").primaryKey(), // client-generated crypto.randomUUID()
    schoolId: text("school_id").notNull(),
    schoolName: text("school_name").notNull(),
    repId: text("rep_id").notNull(),
    repName: text("rep_name").notNull(),
    visitDate: timestamp("visit_date", { withTimezone: true }).notNull(),
    priority: jsonb("priority")
      .$type<VisitFormData["priority"]>()
      .notNull(),
    contact: jsonb("contact").$type<VisitFormData["contact"]>().notNull(),
    purchasing: jsonb("purchasing")
      .$type<VisitFormData["purchasing"]>()
      .notNull(),
    decisionMaking: jsonb("decision_making")
      .$type<VisitFormData["decisionMaking"]>()
      .notNull(),
    marketing: jsonb("marketing")
      .$type<VisitFormData["marketing"]>()
      .notNull(),
    notes: text("notes").default("").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("submissions_rep_id_idx").on(t.repId),
    index("submissions_school_id_idx").on(t.schoolId),
    index("submissions_visit_date_idx").on(t.visitDate),
  ],
);

export type SubmissionRow = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;

// Cycle 6: auth users. Seeded from lib/allowlist.ts. rep_id stays a
// human-readable string (no FK to submissions.rep_id — preserves Cycle 5
// rows). password_updated_at NULL => force change on first login.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  repId: text("rep_id").notNull(),
  role: text("role").notNull(),
  passwordUpdatedAt: timestamp("password_updated_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
