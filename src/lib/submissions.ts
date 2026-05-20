// Cycle 4: local-only submissions + drafts (localStorage).
// Cycle 5 moved submissions to Neon/Drizzle.
// Cycle 12 moved drafts (and a new pending_submissions queue) to
//   IndexedDB via Dexie (`src/lib/db/local.ts`) — the draft helpers
//   that used to live here are gone.
// What stays here: the canonical types, option sets, id minter, and
// date formatters used by every UI surface.

export const SUBMISSIONS_KEY = "wenger.submissions.v1";

// --- Option sets (shared by the form, list badge, and detail view) ---

export const VISIT_PRIORITY_OPTIONS = [
  "Hot — active opportunity",
  "Warm — building relationship",
  "Cold — exploratory",
  "Maintenance — existing customer",
] as const;

export const PROJECT_TIMING_OPTIONS = [
  "Active now",
  "Next 6 months",
  "6–18 months",
  "18+ months",
  "Unknown",
] as const;

export const OPPORTUNITY_SIZE_OPTIONS = [
  "Under $25K",
  "$25K–$100K",
  "$100K–$500K",
  "$500K+",
  "Unknown",
] as const;

export const MET_WITH_OPTIONS = [
  "Head of school",
  "Athletic director",
  "Director of facilities",
  "Performing arts director",
  "Music director",
  "Business officer",
  "Other",
] as const;

export const DECISION_AUTHORITY_OPTIONS = [
  "Final decision-maker",
  "Influencer / recommender",
  "Gatekeeper",
  "Unknown",
] as const;

export const PROCUREMENT_OPTIONS = [
  "Direct purchase",
  "Bid / RFP",
  "Architect-specified",
  "Through district",
  "Unknown",
] as const;

export const BUDGET_STATUS_OPTIONS = [
  "Funded",
  "Partially funded",
  "Pursuing funding",
  "No budget yet",
  "Unknown",
] as const;

export const STAKEHOLDER_OPTIONS = [
  "Board",
  "Head of school",
  "Architect",
  "Construction manager",
  "Athletic dept",
  "Performing arts dept",
  "Facilities",
  "Parents/donors",
  "Other",
] as const;

export const DECISION_TIMELINE_OPTIONS = [
  "Decided",
  "Within 30 days",
  "Within 90 days",
  "Within 6 months",
  "6+ months",
  "Unknown",
] as const;

export const HEARD_ABOUT_OPTIONS = [
  "Existing relationship",
  "Referral",
  "Architect/AEC partner",
  "Conference / trade show",
  "Web search",
  "Cold outreach",
  "Unknown",
] as const;

export const MATERIALS_LEFT_OPTIONS = [
  "Catalog",
  "Spec sheets",
  "Sample finishes",
  "Business card",
  "None",
] as const;

// --- Form / submission shapes ---

export interface VisitFormData {
  priority: {
    visitPriority: string; // required
    projectTiming: string;
    opportunitySize: string;
    nextAction: string; // <= 200 chars
  };
  contact: {
    name: string;
    title: string;
    email: string;
    phone: string;
    metWith: string[];
    otherContact: string; // only when metWith includes "Other"
  };
  purchasing: {
    decisionAuthority: string;
    procurementProcess: string;
    budgetStatus: string;
  };
  decisionMaking: {
    stakeholders: string[];
    competingVendors: string;
    decisionTimeline: string;
  };
  marketing: {
    heardAbout: string[];
    materialsLeft: string[];
    followUpRequested: string;
  };
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
    priority: {
      visitPriority: "",
      projectTiming: "",
      opportunitySize: "",
      nextAction: "",
    },
    contact: {
      name: "",
      title: "",
      email: "",
      phone: "",
      metWith: [],
      otherContact: "",
    },
    purchasing: {
      decisionAuthority: "",
      procurementProcess: "",
      budgetStatus: "",
    },
    decisionMaking: {
      stakeholders: [],
      competingVendors: "",
      decisionTimeline: "",
    },
    marketing: {
      heardAbout: [],
      materialsLeft: [],
      followUpRequested: "",
    },
    notes: "",
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
