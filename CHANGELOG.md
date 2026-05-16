# Changelog

All notable changes per cycle. Newest at top.

Format: `## Cycle N — Title (YYYY-MM-DD)` followed by a short prose summary, then bullet lists for Added / Changed / Fixed / Notes.

---

## Cycle 4 — Visit form & local submissions (2026-05-16)

Replaced the form stub with the full visit form, persisted submissions and debounced drafts to `localStorage`, and built the real My Submissions list + read-only detail. Intentionally local-only — Cycle 5 adds the database.

**Added**
- `src/lib/submissions.ts` — `VisitFormData` / `Submission` / `Draft` types, all option sets, **SSR-guarded** `localStorage` CRUD, `repIdFromName`, `newSubmissionId` (browser `crypto.randomUUID`, no dep), relative/absolute date helpers
- Form primitives: `fields.tsx` (label-wrapped native radio/checkbox/text/textarea, ≥44px tap targets, navy selected state), `collapsible-section.tsx` (chevron rotate, smooth 200ms grid-rows transition, default expanded)
- `components/form/visit-form.tsx` — warm-accented **Priority block** (Visit priority required, enforced with scroll-to + inline error), 5 collapsible sections (Contact/Purchasing/Decision-making/Marketing/Notes) with the exact fields/options specified; "Other contact" enabled only when "Other" is checked; `useReducer` state; debounced (400ms) draft autosave; draft restore w/ "Draft restored — last edited …" + Discard; fixed save bar (Save submission / Save & start another) above the mobile tab bar; ~2s success then route; Back-to-map confirms when there are unsaved changes
- `components/submissions/` — `useSubmissions` hook (SSR-guarded), `submissions-list.tsx` (per-rep, sorted by date desc, empty state, school/city/date/priority badge/notes preview), `submission-detail.tsx` (read-only, same sectioned layout)
- Routes: `/submissions/[id]` (read-only detail); friendly "School not found" / "Submission not found" states

**Changed**
- `/form/[schoolId]`: stub → real form (server resolves school; unknown id → not-found)
- `/submissions`: Cycle 2 placeholder → real list

**Notes**
- **No new dependencies** (no form/validation library, per scope; ids via `crypto.randomUUID`)
- `repId` derived as a kebab-slug of the rep name (rep state has no id until Cycle 6 auth); `repName` denormalized on each submission
- localStorage schema: submissions array under `wenger.submissions.v1`; per-school drafts under `wenger.draft.${repId}.${schoolId}` (drafts are never listed as submissions; cleared on save)
- **Data is local to the browser/device — no sync until Cycle 5.** Photos omitted entirely (flagged Cycle 9+); edit/delete on submissions deferred (future cycle)
- Verification: `npm run build` clean (6 routes), no SSR/hydration/storage errors. The fill→save→list→detail→draft-restore→priority-validation flow is the in-browser portion of the live check
- Live URL unchanged: https://valkolimark-wenger-field-notes.vercel.app

## Cycle 3 — School data & interactive map (2026-05-16)

Brought the 47 schools in as static data and rendered them on an interactive, mobile-friendly Leaflet map with search, tier filter, and a tap-to-preview card. Still no DB/auth/AI.

**Added**
- `src/lib/schools.ts` — 47 schools from the source doc; `Tier` union + `TIER_LABELS`; `School` interface; `enrollment` kept verbatim (often non-numeric); static **hand-derived** coordinates (no runtime geocoding) with `// TODO: verify coords` on the 3 ambiguous entries (Fusion Academy, Turning Point, Oak Park); `schools` exported sorted alphabetically by name
- Client-only Leaflet map (`next/dynamic` `ssr:false` + a "Loading map…" skeleton); custom **navy `#0A3758` `divIcon`** (no default blue marker); OSM standard tiles with the **required attribution kept**; default view `[34.05,-118.35]` z9
- Sticky search (case-insensitive name substring) + thumb-friendly tier pill row + live "Showing X of 47 schools" count + search clear-X; clearing filters restores all 47
- Tap a pin → preview: **bottom sheet on mobile** (map stays visible), **side panel on `md+`**; school name (Georgia serif), address/city, enrollment, tier badge, project activity, navy **"Start visit"**; close via X / tap-outside / Esc
- `/form/[schoolId]` route stub ("coming in Cycle 4") so the URL structure is in place; lives in `(app)` so it inherits the shell
- `docs/California Private School- LA and Architects.docx` committed for data provenance

**Changed**
- `(app)/template.tsx`: switched to an **opacity-only** fade (new `fade-in-soft` keyframe). A lingering CSS `transform` from the prior slide-fade would have re-anchored the `position:fixed` map layer; login's 400ms slide-fade is unchanged
- `/map` now renders the map screen. The map is a full-bleed layer sized to the gap between the Cycle 2 fixed header/tab bar — **no Cycle 2 files restructured; My Submissions untouched**

**Dependencies (approved, flagged)**
- `leaflet@1.9.4`, `react-leaflet@5.0.0` (v5 — required for React 19; v4 needs React 18), `@types/leaflet@1.9.21` (dev)

**Notes**
- **47 schools is authoritative** — the source doc has 47; the spec/CLAUDE.md "49" is an estimate. `CLAUDE.md` was **not** edited (needs explicit approval); the wording mismatch is flagged here for a future CLAUDE.md touch-up
- Coordinates are best-effort static estimates for pin placement, not survey-grade; 3 carry `// TODO: verify coords`. Shared-address entries (Amerigo↔Bishop Montgomery, Windward Middle↔Windward, Brentwood Lower↔Brentwood East) intentionally overlap — accepted for this cycle
- Out of scope and not built (possible future ideas): pin clustering, pin-color-by-tier, custom map styles. Source doc's "Architects (Prop 28/LA USD)" note is unused — possible future sales-context feature
- Verification: `npm run build` clean, no SSR/`window` errors (Leaflet stays client-only), all routes 200. The interactive map (47 pins, filter, tap→preview, Start visit) is the in-browser portion of the live check
- Live URL unchanged: https://valkolimark-wenger-field-notes.vercel.app

## Cycle 2 — Branded app shell & navigation (2026-05-15)

Built the persistent in-app shell (fixed navy header + tab bar) that wraps every authenticated screen, with smooth tab navigation between Map and My Submissions placeholders. Still no auth/DB/AI.

**Added**
- `src/app/(app)/` route group with a shell `layout.tsx`; login `/` stays outside the group (no shell chrome)
- `RepProvider` client context (`src/components/shell/rep-context.tsx`), `localStorage`-backed, mounted at the root layout — client-only rep selection (no auth; Cycle 6)
- `AppHeader`: fixed solid Wenger-navy bar, white logo, rep pill (initial only on narrow viewports, name from `sm:`), logout/switch-rep action; `env(safe-area-inset-top)` padding
- `TabBar`: Map + My Submissions; bottom-fixed and thumb-reachable on mobile, repositioned under the header on `md+`; active tab marked with a sparing warm `#b8612a` underline; ≥44px targets; `env(safe-area-inset-bottom)` padding
- `AppShell`: composes header + scrolling content + tab bar; redirect guard sends a repless visitor (deep-link/logout) back to `/`, with a `ready` flag to prevent flicker
- `(app)/map/page.tsx` and `(app)/submissions/page.tsx` placeholders (Georgia-serif titles, one-line "coming in Cycle N" notes); content clears the fixed header/tab bar with no clipping
- `(app)/template.tsx` for a 200ms CSS fade on each tab navigation; new `--animate-fade-in-fast` token in `globals.css`
- Dependency: `lucide-react@1.16.0` (tab icons)

**Changed**
- Login now persists the selected rep to `localStorage` and routes to `/map` (was `/placeholder`)
- Root `layout.tsx` wraps children in `RepProvider`

**Removed**
- Obsolete Cycle 1 `/placeholder` route (its role is now served by the shell)

**Notes**
- Live URL unchanged: https://valkolimark-wenger-field-notes.vercel.app — Cycle 2 deploy verified (`/map`,`/submissions` → 200; removed `/placeholder` → 404, confirming the new build; commit `19e4e82`)
- **One approved new dependency this cycle: `lucide-react`.** Framer Motion was *not* needed — CSS/keyframe transitions and a `template.tsx` cover the brand's 150–250ms motion rule
- Verification scope: `npm run build` clean, SSR paths + rep-gate verified via dev/live HTTP checks. The interactive authenticated flow (rep persists → header shows name → tab nav → logout) is `localStorage`-driven and is the in-browser portion of the live check

## Cycle 1 — Foundation & branded login (2026-05-15)

Stood up the deployable Next.js app and shipped the Wenger-branded login screen to Vercel. UI only — no auth, database, or AI yet.

**Added**
- Next.js scaffold via `create-next-app`: Next.js 16.2.6, React 19.2.4, TypeScript (strict), Tailwind CSS v4 (4.3.0), ESLint, `src/` dir, App Router, Turbopack
- Wenger brand palette as Tailwind v4 `@theme` tokens in `globals.css` (`brand-navy` `#0A3758`, `-dark` `#082a45`, `-light` `#1a5685`, `-warm` `#b8612a`, `-warm-soft` `#f5ebe0`), plus a `fade-in` keyframe and a Georgia display font token
- Login page (`src/app/page.tsx`): full-bleed `#082a45→#1a5685` gradient, centered white Wenger logo (~80px), Georgia italic "Field Notes" wordmark, "Pick your name to begin" subtitle, 6 glassmorphism rep buttons (Brooke, Jackie, Rahki, Chad, Tam, Linda), ≥44px touch targets, mount fade-in; rep selection routes to `/placeholder?rep=NAME`
- Placeholder page (`src/app/placeholder/`): server page with a `<Suspense>`-wrapped client component reading `useSearchParams` (required by Next 16 to avoid a CSR bailout on the prerendered route); shows "Hi, {rep}" + a "Cycle 2 will build the app shell here" note + "Back to login"
- `AGENTS.md` — Next.js scaffold guidance file (kept as-is)

**Changed**
- Logos relocated from repo root to `/public/` via `git mv` (history preserved): `public/logo-white.png`, `public/logo-blue.png` (both 800×450)
- `layout.tsx`: dropped the scaffold's Geist web fonts for the CLAUDE.md-mandated system font stack; set real metadata; removed the OS `prefers-color-scheme` dark flip to keep brand colors fixed
- Generated `CLAUDE.md`/`README.md` scaffold stubs discarded in favor of the existing project docs

**Notes**
- Live URL: https://valkolimark-wenger-field-notes.vercel.app (Vercel auto-deploy from `main`, commit `f7a6e62`, status Ready)
- Stack is Next 16 / React 19; CLAUDE.md mandates "Next.js 15+", so this satisfies it — no stack deviation
- **No dependencies added beyond the `create-next-app` baseline.** Framer Motion was *not* needed (CSS/keyframe transitions suffice)
- Scaffolding detail: project dir was non-empty and "CaliBlitz" is an invalid npm package name (capitals), so the app was scaffolded into a temp dir as `wenger-field-notes` then moved into place; package name is `wenger-field-notes`
- Production behavior: `/placeholder` initial HTML serves the `<Suspense>` fallback; the rep name renders client-side after hydration — by design, not a defect

## Cycle 0 — Project foundation (2026-05-15)

Project scaffolding before any code: established the rules, the cycle plan, and the brand identity.

**Added**
- `CLAUDE.md` — master project instructions with tech stack, brand rules, cycle discipline, and the full cycle plan
- `README.md` — developer setup and cycle workflow reference
- `CHANGELOG.md` — this file

**Notes**
- Cycle 1 will create the actual Next.js project and ship the branded login screen to Vercel.
- No code committed yet — this is the planning checkpoint.
