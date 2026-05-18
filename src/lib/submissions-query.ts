import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { submissions, type SubmissionRow } from "@/lib/db/schema";

// Single source of truth for the admin submissions query (Cycle 7's
// /api/admin/submissions and Cycle 8's /api/summarize both use this —
// no duplicated query, no third shape).
export async function getSubmissions(
  repId?: string,
): Promise<SubmissionRow[]> {
  const order = [
    desc(submissions.visitDate),
    desc(submissions.createdAt),
  ] as const;

  return repId
    ? db
        .select()
        .from(submissions)
        .where(eq(submissions.repId, repId))
        .orderBy(...order)
    : db.select().from(submissions).orderBy(...order);
}
