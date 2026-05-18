import type { SubmissionRow } from "@/lib/db/schema";

// RFC-4180-ish CSV. Quote fields containing " , CR or LF; escape " as "".
// Leading UTF-8 BOM so Excel reads accented text correctly.
function field(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: string[][]): string {
  return "﻿" + rows.map((r) => r.map(field).join(",")).join("\r\n");
}

const arr = (a: string[] | undefined | null) => (a ? a.join("; ") : "");
const iso = (d: Date | string) =>
  d instanceof Date ? d.toISOString() : String(d ?? "");

const HEADER = [
  "id",
  "schoolId",
  "schoolName",
  "repId",
  "repName",
  "visitDate",
  "createdAt",
  "priority_visitPriority",
  "priority_projectTiming",
  "priority_opportunitySize",
  "priority_nextAction",
  "contact_name",
  "contact_title",
  "contact_email",
  "contact_phone",
  "contact_metWith",
  "contact_otherContact",
  "purchasing_decisionAuthority",
  "purchasing_procurementProcess",
  "purchasing_budgetStatus",
  "decisionMaking_stakeholders",
  "decisionMaking_competingVendors",
  "decisionMaking_decisionTimeline",
  "marketing_heardAbout",
  "marketing_materialsLeft",
  "marketing_followUpRequested",
  "notes",
];

export function submissionsToCsv(subs: SubmissionRow[]): string {
  const rows: string[][] = [HEADER];
  for (const s of subs) {
    rows.push([
      s.id,
      s.schoolId,
      s.schoolName,
      s.repId,
      s.repName,
      iso(s.visitDate),
      iso(s.createdAt),
      s.priority.visitPriority ?? "",
      s.priority.projectTiming ?? "",
      s.priority.opportunitySize ?? "",
      s.priority.nextAction ?? "",
      s.contact.name ?? "",
      s.contact.title ?? "",
      s.contact.email ?? "",
      s.contact.phone ?? "",
      arr(s.contact.metWith),
      s.contact.otherContact ?? "",
      s.purchasing.decisionAuthority ?? "",
      s.purchasing.procurementProcess ?? "",
      s.purchasing.budgetStatus ?? "",
      arr(s.decisionMaking.stakeholders),
      s.decisionMaking.competingVendors ?? "",
      s.decisionMaking.decisionTimeline ?? "",
      arr(s.marketing.heardAbout),
      arr(s.marketing.materialsLeft),
      s.marketing.followUpRequested ?? "",
      s.notes ?? "",
    ]);
  }
  return toCsv(rows);
}
