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

// Cycle 18: header re-shaped for Brooke's redesign — no priority_*
// columns, new projects_needs_*, new purchasing_* (decisionMaker +
// vendors + dealers + contracts/co-ops + funding), new marketing_*
// (channels + nested socials + trade shows). "Other" fill-in stored
// as a parallel `*_other` column per group; the canonical multi-select
// columns are still "; "-joined.
const HEADER = [
  "id",
  "schoolId",
  "schoolName",
  "repId",
  "repName",
  "visitDate",
  "createdAt",
  "contact_selectedContactName",
  "contact_email",
  "contact_phone",
  "contact_metSomeoneElse",
  "projectsNeeds_upcomingProjects",
  "projectsNeeds_currentNeeds",
  "projectsNeeds_timeline",
  "purchasing_decisionMaker",
  "purchasing_decisionMaker_other",
  "purchasing_musicVendor",
  "purchasing_athleticVendor",
  "purchasing_dealers",
  "purchasing_dealers_other",
  "purchasing_contractsCoops",
  "purchasing_funding",
  "purchasing_funding_other",
  "marketing_channels",
  "marketing_channels_other",
  "marketing_socialPlatforms",
  "marketing_tradeShows",
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
      s.contact.selectedContactName ?? "",
      s.contact.email ?? "",
      s.contact.phone ?? "",
      s.contact.metSomeoneElse ?? "",
      s.projectsNeeds.upcomingProjects ?? "",
      s.projectsNeeds.currentNeeds ?? "",
      s.projectsNeeds.timeline ?? "",
      s.purchasing.decisionMaker ?? "",
      s.purchasing.decisionMakerOther ?? "",
      s.purchasing.musicVendor ?? "",
      s.purchasing.athleticVendor ?? "",
      arr(s.purchasing.dealers),
      s.purchasing.dealersOther ?? "",
      s.purchasing.contractsCoops ?? "",
      arr(s.purchasing.funding),
      s.purchasing.fundingOther ?? "",
      arr(s.marketing.channels),
      s.marketing.channelsOther ?? "",
      arr(s.marketing.socialPlatforms),
      s.marketing.tradeShows ?? "",
      s.notes ?? "",
    ]);
  }
  return toCsv(rows);
}
