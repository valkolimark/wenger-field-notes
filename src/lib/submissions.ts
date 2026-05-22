// Cycle 4: local-only submissions + drafts (localStorage).
// Cycle 5 moved submissions to Neon/Drizzle.
// Cycle 12 moved drafts (and a new pending_submissions queue) to
//   IndexedDB via Dexie (`src/lib/db/local.ts`) — the draft helpers
//   that used to live here are gone.
// Cycle 18 (Brooke's visit-form redesign): the priority block is gone
//   and the section shapes are completely reorganized
//   (contact-first; new Projects/Needs, Purchasing, Marketing).
//   "Other: ___" is stored as a parallel `*Other` string per group
//   (cleaner CSV + AI prompts than inlining `"Other: foo"` in arrays).
// What stays here: the canonical types, option sets, id minter, and
// date formatters used by every UI surface.

export const SUBMISSIONS_KEY = "wenger.submissions.v1";

// --- Option sets (shared by the form, list, detail view, CSV, prompts) ---

// Cycle 18 — Projects/Needs timeline (replaces the old projectTiming
// + opportunitySize fields). Single-select radio.
export const TIMELINE_OPTIONS = [
  "ASAP",
  "Next 6 months",
  "6–18 months",
  "18+ months",
  "Unknown",
] as const;
export type Timeline = (typeof TIMELINE_OPTIONS)[number];

// Cycle 18 — Purchasing: who makes the decisions.
// "Other" is NOT in the canonical list; it's handled via a parallel
// `decisionMakerOther` string field (and a sentinel "Other" value on
// the main field while the rep is filling the Other text in).
export const DECISION_MAKER_OPTIONS = [
  "Head of School",
  "Operations/Business",
  "Visual/Performing Arts Department",
  "Athletics Department",
] as const;

// Cycle 18 — Dealers multi-select. Parallel `dealersOther` string for
// the Other fill-in (same convention as the rest of the Other fields).
export const DEALER_OPTIONS = [
  "Music & Arts",
  "School Specialty",
  "Virco",
] as const;

// Cycle 18 — Funding sources multi-select. Parallel `fundingOther`.
export const FUNDING_OPTIONS = [
  "Annual Budget",
  "Capital Campaign",
  "Donations",
  "Grants",
  "Booster Club",
  "Foundation",
] as const;

// Cycle 18 — Marketing channel preferences. Parallel `channelsOther`.
// "Social Media" is a checkbox here; its nested platforms live in a
// separate field (only meaningful when this checkbox is set).
export const MARKETING_CHANNEL_OPTIONS = [
  "Email",
  "Phone Calls",
  "In person visits",
  "Social Media",
  "Printed Materials",
  "Trade Shows/Events",
] as const;

// Cycle 18 — Nested social platforms (only relevant when
// MARKETING_CHANNEL_OPTIONS includes "Social Media" in `channels`).
// Cleared on save if "Social Media" is not checked.
export const SOCIAL_PLATFORM_OPTIONS = [
  "TikTok",
  "Instagram",
  "Facebook",
] as const;

// --- Form / submission shapes (Cycle 18 redesign) ---

export interface ContactBlock {
  /** name (matches one of school.contacts[].name), "" if none picked. */
  selectedContactName: string;
  /** Free text — the spreadsheet doesn't carry these, rep fills. */
  email: string;
  phone: string;
  /** Always-on free text: a person not in school.contacts. */
  metSomeoneElse: string;
}

export interface ProjectsNeedsBlock {
  upcomingProjects: string;
  currentNeeds: string;
  /** "" = unanswered (no longer required per Cycle 18). */
  timeline: Timeline | "";
}

export interface PurchasingBlock {
  /** A canonical option, "Other" (sentinel — Other text in companion field), or "". */
  decisionMaker: (typeof DECISION_MAKER_OPTIONS)[number] | "Other" | "";
  decisionMakerOther: string;
  musicVendor: string;
  athleticVendor: string;
  /** Subset of DEALER_OPTIONS. Other fill-in is stored separately. */
  dealers: string[];
  dealersOther: string;
  /** Free text — "Do they purchase through national contracts or co-ops?" */
  contractsCoops: string;
  /** Subset of FUNDING_OPTIONS. Other fill-in stored separately. */
  funding: string[];
  fundingOther: string;
}

export interface MarketingBlock {
  /** Subset of MARKETING_CHANNEL_OPTIONS. Other fill-in stored separately. */
  channels: string[];
  channelsOther: string;
  /** Subset of SOCIAL_PLATFORM_OPTIONS. Cleared on save if "Social Media"
   *  is not in `channels`. */
  socialPlatforms: string[];
  /** Free text — "What kind of trade shows or events do they attend?" */
  tradeShows: string;
}

export interface VisitFormData {
  contact: ContactBlock;
  projectsNeeds: ProjectsNeedsBlock;
  purchasing: PurchasingBlock;
  marketing: MarketingBlock;
  notes: string;
}

export interface Submission extends VisitFormData {
  id: string;
  schoolId: string;
  schoolName: string;
  repId: string;
  repName: string;
  visitDate: string; // ISO, set on save
}

export function createEmptyForm(): VisitFormData {
  return {
    contact: {
      selectedContactName: "",
      email: "",
      phone: "",
      metSomeoneElse: "",
    },
    projectsNeeds: {
      upcomingProjects: "",
      currentNeeds: "",
      timeline: "",
    },
    purchasing: {
      decisionMaker: "",
      decisionMakerOther: "",
      musicVendor: "",
      athleticVendor: "",
      dealers: [],
      dealersOther: "",
      contractsCoops: "",
      funding: [],
      fundingOther: "",
    },
    marketing: {
      channels: [],
      channelsOther: "",
      socialPlatforms: [],
      tradeShows: "",
    },
    notes: "",
  };
}

/** Cycle 18: normalize the form before save. Currently just clears
 *  nested social platforms when "Social Media" is not selected and
 *  trims orphan "Other" text. Called in the form's save path AND in
 *  the API validators so client + server agree on canonical shape. */
export function normalizeFormData(data: VisitFormData): VisitFormData {
  const socialChecked = data.marketing.channels.includes("Social Media");
  const otherChannelChecked = data.marketing.channels.includes("Other");
  const otherDealerChecked = data.purchasing.dealers.includes("Other");
  const otherFundingChecked = data.purchasing.funding.includes("Other");
  const decisionIsOther = data.purchasing.decisionMaker === "Other";
  return {
    ...data,
    purchasing: {
      ...data.purchasing,
      decisionMakerOther: decisionIsOther
        ? data.purchasing.decisionMakerOther
        : "",
      dealersOther: otherDealerChecked ? data.purchasing.dealersOther : "",
      fundingOther: otherFundingChecked ? data.purchasing.fundingOther : "",
    },
    marketing: {
      ...data.marketing,
      channelsOther: otherChannelChecked
        ? data.marketing.channelsOther
        : "",
      socialPlatforms: socialChecked ? data.marketing.socialPlatforms : [],
    },
  };
}

/** Rep state holds only a name until Cycle 6 auth; derive a stable id. */
export function repIdFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function newSubmissionId(schoolId: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${schoolId}-${Date.now()}`;
}

// --- localStorage CRUD (browser-only; no-ops / [] on the server) ---
// Cycle 5 legacy: these support a one-time backfill from the original
// localStorage submissions key. Kept verbatim for backward compat;
// the type cast is now structurally inaccurate for old-shape rows,
// but the API validators (Cycle 18) will 400 any old-shape POST.

export function loadAllSubmissions(): Submission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SUBMISSIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Submission[]) : [];
  } catch {
    return [];
  }
}

/** Cycle 5: remove the legacy local submissions key after backfill. */
export function clearLegacySubmissions(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SUBMISSIONS_KEY);
  } catch {
    // ignore
  }
}

// --- Date formatting ---

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatVisitDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 7 * 24 * 60 * 60 * 1000) return formatRelative(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
