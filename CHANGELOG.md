# Changelog

All notable changes per cycle. Newest at top.

Format: `## Cycle N — Title (YYYY-MM-DD)` followed by a short prose summary, then bullet lists for Added / Changed / Fixed / Notes.

---

## Cycle 9 — Polish & launch (2026-05-18)

Final polish and launch handoff. The team starts using the app on the existing `vercel.app` URL (custom domain deferred per request).

**CLAUDE.md edits (Checkpoint 1):**
- Typography rule → "system sans stack everywhere, no serif fonts anywhere"
- Intro → "California sales team (5 reps + 2 admins)" (was "6-person")
- Cycle 9 scope line → "team onboarding (handoff to admin Mark; no email sending)"

**GATE 1 decisions:**
- **Button palette** → shared `<Button>` + `buttonClass()` (`components/ui/button.tsx`): primary `#0A3758` white (AAA 11.7:1), destructive **`#B42318`** white (AA 5.9:1 — a deliberately distinct red, never the warm priority accent `#b8612a`), secondary outline, ghost; `active:scale-[.98]` + 200ms ease-out
- **Toast/confirm** → hand-rolled (`components/ui/toast.tsx`, **no dep**): `useToast()` success/error toasts + promise `confirm()` modal replacing `window.confirm`
- **Skeletons** → shared `<Skeleton>`/`RowsSkeleton`/`FormSkeleton` (`components/ui/skeleton.tsx`) used in route `loading.tsx` + client fetch states
- **Error boundaries** → shared `<ErrorState>`; `global-error.tsx`, app-shell `(app)/error.tsx`, and per-route `error.tsx` for form/submissions/map/account/admin/admin-users
- **Custom domain → deferred** (user said bypass the subdomain for now); stays on `valkolimark-wenger-field-notes.vercel.app`

**Shipped**
- **Sans-serif sweep:** removed `--font-display` token + every `font-display` class across 12 files — `grep -ri "georgia\|font-display\|font-serif" src/` is empty (no Tailwind config file; v4 `@theme`)
- Loading `loading.tsx` for `/submissions /admin /admin/users /account /form/[schoolId] /map`; helpful empty/filter-empty states; error boundaries everywhere
- **Per-screen polish:** `/form` (toast-confirm on discard, `<Button>`, save toast, autosave note) · `/submissions` (skeleton, empty copy, button) · `/map` (Start-visit button, error boundary) · `/account` (save toasts, `<Button>`) · `/admin`+`/admin/users` (**all `window.confirm` → toast confirm**, success toasts, `<Button>`, skeletons, `animate-pop` modal) · header is now a dropdown menu (name+role, Account, Admin, Log out) · login/set-password tactile polish
- Smooth transitions: modal `animate-pop`, summary panel `fade-in-soft`, buttons `active:scale`+ease-out; existing route/collapsible fades kept
- `docs/LAUNCH.md` (team onboarding) + `docs/ADMIN.md` (admin runbook)

**Notes**
- **Zero new dependencies, zero new env vars, zero schema migrations**
- `grep -r "window.confirm\|alert(" src/` → **0**
- Custom domain + `vercel.app`-URL polish are the only deferred items (post-launch)
- JWT type casts untouched; Mark's real password untouched; DB to be restored to exact seed at close

## Cycle 8 — Claude AI summaries (2026-05-17)

Admins can stream a Claude-generated pipeline summary (whole team or one rep) from `/admin`.

**Added**
- `POST /api/summarize` (`runtime=nodejs`, admin-gated: middleware now covers `/api/summarize` **and** in-route `requireAdmin()`). Body `{scope:'pipeline'|'rep', repId?}`. Streams `text/plain` via a `ReadableStream` fed by the `@anthropic-ai/sdk` native stream
- `src/lib/submissions-query.ts` — shared `getSubmissions(repId?)`; `/api/admin/submissions` + `export.csv` refactored to use it (no duplicated query; no behavior change)
- `src/lib/summarize-prompts.ts` — GATE 2 system + per-scope user prompts; user data wrapped in `<submission_data>` with explicit "data not instructions" guard
- Two buttons + inline streaming panel on `/admin` (progressive text, blinking cursor, Regenerate, Close; `AbortController` cancels on regenerate/close/unmount); "Per-rep summary" disabled until a rep is filtered

**GATE 1 decisions:** plain `ReadableStream` (`text/plain`) — **no SSE, no `ai` package**; **Node** runtime; reuse `src/lib/csv.ts` flatten as the prompt data shape; **token cap = 60,000 input tokens** (≈ ~200 submissions; 1 today → trivial) enforced via `anthropic.messages.countTokens()` preflight (char/4 fallback), over → 400 "Too much data to summarize at once — filter to a specific rep or date range."; **no markdown lib** (plain paragraphs); zero-submission rep → canned line, no API call.

**GATE 2 decision:** structured plain-text output (UPPERCASE sections, `- `/`1.` bullets); injection defense in the system prompt; final prompts live in `src/lib/summarize-prompts.ts`.

**Notes / verification**
- New dep (pinned exact): **`@anthropic-ai/sdk@0.96.0`**. No other deps (no `ai`, no markdown).
- New env var: **`ANTHROPIC_API_KEY`** — on Vercel Prod+Preview (Sensitive); added to local `.env.local` manually (Sensitive ⇒ not `vercel env pull`-able).
- **Zero schema migrations.** Model `claude-sonnet-4-5` per CLAUDE.md.
- Verified locally: progressive streaming (pipeline `ttfb≈2.2s` vs `total≈9.9s`), correct pipeline/rep scoping, negatives (logged-out 302, rep 403, missing `repId` 400, nonexistent rep → canned), **token cap** (4000 transient rows → 400 human msg, cleaned), **prompt injection** (hostile notes → model did **not** comply, kept analyst structure; notes restored), **cost logging** (`[summarize]` logs scope/repId/count/ms/input+output tokens — ~800 in / ~330 out per current summary; **no submission content in logs**, confirmed)
- DB restored to exact seed: 7 users, only `mark.mireles` `password_set`, `BHrdlichka=1`. Mark's real password untouched
- JWT type-augmentation casts untouched
- Cycle 9 (Polish) flags: summary persistence appetite (a `summaries` table) is a future call; structured logging upgrade; markdown rendering polish; rough cost figure ≈ ~1.1k tokens/summary at current data (well under a cent) — revisit caps/budget alerts at real volume

## Cycle 7 — Admin dashboard (2026-05-17)

Admin dashboard at `/admin`: full submissions view (filter, expandable detail, CSV export) + complete user management (add / edit / reset-password / delete-with-mandatory-reassignment), admin-gated with defense in depth.

**Added**
- Middleware extended: `/admin/*` and `/api/admin/*` require `role==='admin'` (pages→`/map`, APIs→403); runs after the auth/force-change gates
- `requireAdmin()` helper (session-`repId` derived; per-route check on every admin API — defense in depth)
- 7 API routes (`runtime=nodejs`, never return/log password hashes): `GET /api/admin/submissions[?repId=]`, `GET /api/admin/submissions/export.csv`, `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/[id]`, `POST /api/admin/users/[id]/reset-password`, `DELETE /api/admin/users/[id]`
- `/admin` (submissions: stats, rep filter, CSV export honoring filter, expandable read-only detail) and `/admin/users` (list with role/passwordSet/submissionCount; add; inline edit; reset-password w/ confirm; delete w/ reassignment modal) — both server-role-checked, branded, mobile-first card layouts; `AdminNav` sub-nav
- Header: `Shield` link to `/admin`, rendered only for `role==='admin'`
- `src/lib/csv.ts` (hand-rolled, zero deps), `src/lib/admin.ts`

**GATE 1 decisions (approved):**
- Layout: **separate routes under the `(app)` shell** (`/admin` + `/admin/users`) with in-page sub-nav
- CSV: **hand-rolled** RFC-4180 (BOM for Excel, quote/escape) — **no `papaparse`** (not installed; "don't add a dep just in case")
- CSV JSONB: **flattened, section-prefixed columns** (`priority_…`, `contact_…`, …); multi-selects joined with `; `
- RepId-edit safety: **(a) disallow** repId change when the user has ≥1 submission (409); reassignment stays the explicit delete-flow path
- **Driver constraint:** `drizzle-orm/neon-http` has **no interactive `db.transaction()`** → atomicity via **`db.batch([...])`** (single Neon server-side transaction)

**GATE 2 decision (approved):** `DELETE` validates everything *before* any write (403 non-admin, 404 missing, 403 self, 400 missing/both/bad-`reassignTo`); then a 2-statement `db.batch` — reassign branch `[UPDATE submissions SET rep_id/rep_name, DELETE user]`, delete-all branch `[DELETE submissions, DELETE user]`; 0-subs = simple delete. No row locking (single admin actor, batch atomic).

**Self-protections:** admin can't change own role (403) or delete self (403, UI-disabled).

**Notes**
- **Zero new dependencies, zero new env vars, zero schema migrations** (no `drizzle-kit generate`; reuses `SEED_PASSWORD`, `users`/`submissions` tables)
- Cycle 6 close-out follow-up: CLAUDE.md "6-person sales team" intro **left unedited** (no explicit approval given; CHANGELOG remains the record) — Checkpoint 1 documented no-op
- Verified (local curl matrix): non-admin 403 (middleware + per-route), submissions all/filtered, CSV (BOM/escaping/no hashes), users DTO has no `passwordHash`, add+dup(409), PATCH name/role, self-role-change 403, repId-with-submissions 409, reset→bootstrap, DELETE 0-subs/self/reassign/delete-all/bad-reassign/missing-choice all correct & atomic (no partial state)
- **Final DB state restored to seed:** 7 users, only `mark.mireles` (`MMireles`) `password_set=true`, other 6 bootstrap; submissions `BHrdlichka=1`; all test users/submissions/reassignments reverted. Mark's real password never touched
- JWT type-augmentation casts untouched (Cycle 6 known-flaky decision)
- Cycle 8 awareness: admin submissions data + CSV flattening shape is a natural input for the Claude AI pipeline summary
- Polish deferrals (Cycle 9): admin uses `window.confirm` for simple confirms; tables are card-style on mobile; no toast system yet

## Cycle 6.5 — User self-service profile edit (2026-05-17)

Logged-in users can edit their own name, email, and password at a new `/account` page. No admin user management (that's Cycle 7).

**Added**
- `PATCH /api/account` (`runtime=nodejs`) — partial `{name,email,currentPassword,newPassword}`; **target user derived only from the `auth()` session, request-body identity ignored**; name trim/≤120; email lowercase + format + uniqueness-excluding-self (409); password requires bcrypt-verified `currentPassword` + new ≥8; single `UPDATE`; `password_updated_at=now()` only on password change; returns `{name,email,repId,role}`; human error messages
- `/account` page (`src/app/(app)/account/page.tsx` server → `account-form.tsx` client): three independently-savable sections (Name / Email / Password), branded, reuses the form `TextField` primitive; per-section Saved/error states (Saved auto-dismisses ~2s); password fields cleared on success
- Header user pill is now a `/account` link (≥44px tap target) alongside Log out

**Changed**
- `lib/auth.ts` `jwt` callback: added a `trigger==="update"` branch so `useSession().update({name,email})` refreshes the header without re-login. The flagged NextAuth-beta `token.* as …` augmentation casts in the `session` callback were **left untouched** (locked decision)

**Notes**
- **Zero new dependencies, zero new env vars, zero schema migrations** (`users` already had `name`/`email`/`password_hash`/`password_updated_at`; no `drizzle-kit generate` run)
- **Middleware unchanged** — Cycle 6's rules are path-generic, so unauth→`/` and `mustChangePassword`→`/set-password` already gate `/account` and `/api/account`. Adding a special-case would introduce a new pattern the brief forbids (Checkpoint 5 = verified no-op)
- Password change updates the hash + `password_updated_at` but does **not** invalidate the current JWT session (no session-revocation in scope) — "next login uses new password" holds; the active session continues
- New/confirm password match is enforced client-side; the API takes `newPassword` only
- Deferred to Cycle 7 (unchanged): admin edit/reset/add/remove users + reassignment; changing `repId`/`role`; email verification; avatars; self-deletion
- Date note: this cycle landed 2026-05-17

## Cycle 6 — Real authentication (2026-05-16)

Replaced the rep selector with email + password auth (NextAuth v5 Credentials, JWT sessions, no email sending). Users are seeded from a 7-person allowlist with a generic bootstrap password and forced to change it on first login.

**Added**
- `next-auth@5.0.0-beta.31` (pinned), `bcryptjs@3.0.3`, `@types/bcryptjs@2.4.6` (dev)
- `src/lib/allowlist.ts` — 7-person roster (2 admins, 5 reps), lowercase emails
- `users` table (uuid pk, unique email, name, password_hash, rep_id, role, password_updated_at, created_at); migration `drizzle/0001_whole_whizzer.sql`
- `scripts/seed-users.ts` + `npm run db:seed` — one bcrypt hash of `SEED_PASSWORD` (cost 10), idempotent upsert by email, `password_updated_at = NULL`. Seeded 7 users
- `src/lib/auth.ts` (NextAuth v5: Credentials, JWT, jwt/session callbacks expose `repId`/`role`/`mustChangePassword`), `app/api/auth/[...nextauth]/route.ts`
- Branded email+password sign-in on `/`; `/set-password` force-change screen (server action: validate, rehash, `password_updated_at = now()`, re-issue JWT, → `/map`)
- `middleware.ts` — unauth → `/`; authed + `mustChangePassword` → `/set-password`; `/api/auth/*` + static excluded
- `SessionProvider` (`components/providers.tsx`)

**Changed**
- `/api/submissions` GET/POST + `/[id]`: identity from session (`auth()`), client `repId` trust dropped; reps see own, admins see all (server); `[id]` 401/404/403. **All `TODO(cycle-6)` markers resolved (none remain).**
- Shell reconciled to the session: `AppHeader` (name + `signOut`), `AppShell` (dropped the localStorage rep gate — middleware now protects), `use-submissions()` (no `repId` arg), `visit-form`/`submissions-list` use the session
- CLAUDE.md cycle plan updated (Cycle 6 rewrite, Cycle 6.5 inserted, Cycle 7 expanded) — pre-approved

**Removed**
- Rep selector UI; `rep-context.tsx`; obsolete `migrate-legacy.tsx`

**Decisions / notes (flagged)**
- **Deliberate Cycle 6 caveat:** the API returns *all* rows for admins (for Cycle 7's `/admin`), but the rep-facing `/submissions` tab filters to the viewer's own `repId` — so in Cycle 6 **admins see only their own on `/submissions`**; the admin "see all" UI ships in Cycle 7.
- **`CParish → CParrish` fix did NOT run** — no `CParish` rows existed. Instead the same migration remapped the one legacy row `rep_id 'brooke' → 'BHrdlichka'` (old Cycle 1–5 name-slug scheme → allowlist repId), preserving it for Brooke post-auth.
- **Roster count discrepancy:** CLAUDE.md intro still says "6-person sales team"; the real roster is **5 reps + 2 admins = 7**. Intro text left unedited (no fresh approval) — noted here only.
- Locked decisions honored: bcryptjs; `SEED_PASSWORD` (`Wenger2026!`) in env not code; lowercase emails; Chad = `CParrish`; `submissions.rep_id` stays string (no FK); JWT-only; `AUTH_TRUST_HOST`.
- `db:seed` uses `npx tsx` (transient; **no committed dep added** — deps stayed at the 3 approved).
- `next-auth/jwt` type augmentation is flaky under the beta — `token.*` claims are cast in the session callback (Session/User augmentation works).
- New env vars required on the live project (Prod/Preview/Dev): `AUTH_SECRET`, `SEED_PASSWORD` (Sensitive), `AUTH_TRUST_HOST=true`. `DATABASE_URL` unchanged from Cycle 5.

## Cycle 5 — Database & persistence (2026-05-16)

Submissions moved from `localStorage` to Neon Postgres (Drizzle + `@neondatabase/serverless`), so they survive refresh and sync across devices for the same rep. Drafts stay local. No auth yet.

**Added**
- Neon Postgres via the **Vercel Marketplace** integration (`neon-sky-river`); env vars in Production/Preview/Development
- `src/lib/db/schema.ts` — `submissions` table: text `id` PK (client uuid), `school_id/school_name/rep_id/rep_name` text, `visit_date` timestamptz, the 5 sectioned blocks as **`jsonb` `.$type<…>()`** against Cycle 4 form sub-types, `notes` text default `''`, `created_at/updated_at` timestamptz `now()`; indexes on `rep_id`/`school_id`/`visit_date`
- `src/lib/db/client.ts` — pooled `DATABASE_URL`, `neon()` + `drizzle(neon-http)`, throws if unset
- `drizzle.config.ts` (+ `dotenv` reading `.env.local`); committed migration `drizzle/0000_classy_blob.sql` (applied to Neon)
- API (`runtime='nodejs'`, try/catch human 500): `POST /api/submissions` (hand-validated scalars, 400 human msg, `onConflictDoNothing(id)`, returns row), `GET /api/submissions?repId=…` (400 if missing; sorted `visit_date desc, created_at desc`), `GET /api/submissions/[id]` (row or 404 `Submission not found`)
- `migrate-legacy.tsx` — one-time, idempotent local→Neon backfill mounted once in `(app)/layout.tsx`; clears `wenger.submissions.v1` on full success, quiet toast on partial; **drafts untouched**
- Loading/error states: list 3 skeleton cards + error banner w/ Try again; detail skeleton + 404 + retry; save bar "Saving…" + inline error

**Changed**
- `use-submissions.ts` → `fetch('/api/submissions?repId=…')` on mount + window focus; same exported name; adds `error`/`refresh`; keeps last-known data on error
- `visit-form.tsx` → saves via `POST`; **draft cleared only on 2xx**; failure preserves the form and shows a standard-red inline error (warm `#b8612a` reserved for priority)
- `submission-detail.tsx` → reads `GET /api/submissions/[id]` (works on a fresh browser / deep-link)
- `src/lib/submissions.ts` — **deleted** the now-dead `appendSubmission` / `loadSubmissionsForRep` / `getSubmission` (avoid two sources of truth); kept all types, draft helpers, `loadAllSubmissions`, added `clearLegacySubmissions`

**Dependencies (approved, flagged):** `drizzle-orm@0.45.2`, `@neondatabase/serverless@1.1.0`; dev: `drizzle-kit@0.31.10`, `dotenv@17.4.2`. Bundle impact: server-only (db client/driver, API routes) — **no DATABASE_URL or connection string in client chunks** (verified `grep .next/static`); negligible client JS delta.

**Notes / flagged**
- **Pooled var = `DATABASE_URL`** (host contains `-pooler`); `DATABASE_URL_UNPOOLED` + `POSTGRES_*`/`PG*` also injected but unused. App uses `DATABASE_URL` only
- Auth deferred to Cycle 6: server **trusts `repId` in the request this cycle only** — `TODO(cycle-6)` markers on every server read; `GET /api/submissions/[id]` has no rep filter yet (Cycle 6 adds 403 on session mismatch)
- No Cycle 4 `Submission` field needed a JSON-shape judgment call — the 5 blocks map 1:1 to `jsonb` columns
- Housekeeping: Vercel CLI appended `.env*.local` to `.gitignore` (committed; `.env.local` + `.vercel` confirmed ignored — no secrets tracked)
- **Infra reality (flagged):** there are two Vercel projects under team `fast-paced` — the live app is **`valkolimark-wenger-field-notes`** (Git auto-deploy; serves the live URL) and a separate CLI-linked **`wenger-field-notes`**. Neon (`neon-sky-river`, the migrated DB) was first connected to the wrong (`wenger-field-notes`) project; a stale empty Neon resource (`neon-cyan-drawer`) on the live project was disconnected; `neon-sky-river` was then connected to **`valkolimark-wenger-field-notes`** via the dashboard. `.vercel/` is now linked to the live project.
- **Sensitive env vars:** the dashboard connect created `DATABASE_URL` as **Sensitive** → `vercel env pull` returns it blank by design. It IS present at function runtime — verified by redeploy + live API, not by pull. Local dev/migrations use the working `DATABASE_URL` already in `.env.local` (same Neon DB).
- **Follow-ups (not blocking):** `neon-sky-river` is still also connected to the unused `wenger-field-notes` project; the orphaned `neon-cyan-drawer` resource and the unused project should be tidied in a later polish pass.
- Verified: build clean (8 routes incl. 2 API), drizzle-kit no schema drift, **full production round-trip against the live URL** (`/api/submissions` create/idempotent/list/by-id/400/404 → correct) with smoke rows deleted; no `DATABASE_URL` in client chunks. Cross-device same-rep sync, legacy backfill clearing, and offline-save-preserves-draft are the in-browser portions of the live check.
- Live URL unchanged: https://valkolimark-wenger-field-notes.vercel.app

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
