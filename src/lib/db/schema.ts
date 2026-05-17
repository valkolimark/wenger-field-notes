import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
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
