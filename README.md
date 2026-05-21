# Wenger Field Notes

A mobile-first sales field app for Wenger Corporation's sales team. Reps capture school visit notes from their phones; admins see the aggregated pipeline and get AI-generated summaries from Claude.

**Live URL:** https://valkolimark-wenger-field-notes.vercel.app

---

## For developers

### Setup

Requirements: Node.js 22 LTS, Git, an Anthropic API key (later cycles), a Vercel account, a GitHub account.

```bash
git clone <repo-url>
cd wenger-field-notes
npm install
npm run dev
```

Then open http://localhost:3000.

### Environment variables

Create `.env.local` in the project root. Variables required per cycle:

- **Cycle 1-2:** None
- **Cycle 5+ (active):** `DATABASE_URL` — the **pooled** Neon connection
  (host contains `-pooler`), plus `DATABASE_URL_UNPOOLED` and the
  `POSTGRES_*` / `PG*` family. All auto-injected by the **Neon Vercel
  Marketplace** integration. The app uses `DATABASE_URL` only.
  Note: on the live project the Neon vars are marked **Sensitive**, so
  `vercel env pull` returns them blank — for local dev/migrations keep a
  working `DATABASE_URL` in `.env.local` (same Neon DB), or copy the
  connection string from the Neon dashboard. `.env.local` is gitignored.
- **Cycle 6+ (active):** `AUTH_SECRET` (NextAuth JWT signing —
  `openssl rand -base64 32`), `SEED_PASSWORD` (generic bootstrap
  password, mark **Sensitive**), `AUTH_TRUST_HOST=true`. Set on the live
  project for Production/Preview/Development. No Resend / email sending.
  `SEED_PASSWORD` is read only by `npm run db:seed` (never committed; pass
  inline locally).
- **Cycle 8+ (active):** `ANTHROPIC_API_KEY` — Claude API key for AI
  summaries. On Vercel Prod/Preview (mark **Sensitive**); add to local
  `.env.local` manually (Sensitive ⇒ `vercel env pull` returns it blank).
  Server-only — never in client code.
- **Cycle 13+ (active):** `BLOB_READ_WRITE_TOKEN` — Vercel Blob read-
  write token, auto-created when the Blob store is provisioned via
  the Vercel dashboard (Storage → Create → Blob) on Prod/Preview/Dev
  (mark **Sensitive**). The store is configured **private**; uploads
  go directly from the client via `@vercel/blob/client`, and reads
  stream through a server-side proxy. Like the Neon vars,
  `vercel env pull` returns it blank — copy from the dashboard into
  `.env.local` for local development. Server-only.

**First-time login:** allowlisted users sign in with their email and the
bootstrap password (`Wenger2026!`). On first login they're forced to
`/set-password` to choose a new one (min 8 chars) before entering the app.
There is no rep selector — authentication is by email + password.

**Profile (Cycle 6.5):** any signed-in user can manage their own
name, email, and password at **`/account`** (linked from the header
user pill). Email/password changes take effect at next login; name and
email update in the header immediately.

**Admin dashboard (Cycle 7):** admins get `/admin` (Shield icon in the
header, admin-only). Submissions tab: all reps' visits with a rep filter,
expandable detail, and a one-click CSV export (UTF-8, JSONB flattened to
columns). Users tab: add/edit users, reset a user's password (forces a
change on their next login), and delete users — deleting a user with
submissions requires reassigning them to another user or explicitly
deleting them (atomic). Admins can't change their own role or delete
themselves. Gated by middleware **and** a server-side check on every
admin route/page.

**AI summaries (Cycle 8; vision in Cycle 13):** on `/admin` the
Submissions tab has **Summarize pipeline** and **Per-rep summary**
buttons — Claude (`claude-sonnet-4-5`) streams a structured plain-text
analysis of the team's (or a rep's) logged visits into an inline panel
(Regenerate / Close). Each expandable submission row also has a
**Deep analysis** button (visible when the visit has ≥1 photo) for a
single-visit summary that references what's in the photos. All three
summary scopes are vision-aware — Claude sees the attached photos as
base64 image blocks alongside the form data. Server-side input-token
cap (60k); over-cap falls back by dropping the oldest photos first.
Summaries are on-demand only (not persisted). Requires
`ANTHROPIC_API_KEY`.

### Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Leaflet + react-leaflet (OpenStreetMap tiles) · lucide-react · Neon Postgres · Drizzle ORM · NextAuth v5 · Anthropic SDK · Vercel Blob · IndexedDB (Dexie) · Service Worker (Serwist) · Deployed on Vercel.

### Data

School data is **static** — no runtime geocoding or external API. The 39
schools live in `src/lib/schools.ts`, grouped into 4 tiers (canonical
display order exported as `SCHOOL_TIERS`). Each `School` carries
`id`, `name`, `tier`, `location`, `enrollment`, `projectActivity`,
`contacts: { role, name }[]`, `notes` (historical territory notes
shown to reps as "Background"), and `lat`/`lng` (hand-derived from
the location strings; a handful of multi-campus / address-inconsistent
records carry `// TODO: verify coords` for the team to spot-check).
Source of record: `California_Planning.xlsx` (Brooke, May 2026).

**Cycle 15:** the Leaflet pin map is back at `/map`. A Map/List toggle
in the toolbar lets reps switch to the tier-grouped list for scanning
by name. Search + tier-pill filters apply to both views. The Cycle 14
"Coordinates pending" banner is gone now that the dataset carries
lat/lng.

### Visit form & submissions

Reps open a school from the map and fill the visit form at
`/form/[schoolId]` — a warm-accented **priority block** (Visit priority is
the only required field) plus collapsible Contact / Purchasing /
Decision-making / Marketing / Notes sections. As they work, an in-progress
**draft** auto-saves (debounced). On save, the submission is POSTed to the
API and shows in **My Submissions** (`/submissions`) with a read-only
detail at `/submissions/[id]`.

**Cycle 5 — submissions now live in Neon Postgres; drafts remain local.**

- **Submissions** → `submissions` table in Neon (Drizzle ORM,
  `@neondatabase/serverless`). The 5 sectioned blocks are stored as
  `jsonb`. API: `POST /api/submissions`, `GET /api/submissions?repId=…`,
  `GET /api/submissions/[id]` (`runtime = 'nodejs'`). Schema in
  `src/lib/db/schema.ts`; migrations in `drizzle/` (`drizzle-kit`). They
  survive refresh and **sync across devices for the same rep**.
- **Drafts** stay in `localStorage` under
  `wenger.draft.${repId}.${schoolId}` — one in-progress draft per
  school+rep; cleared on successful save, never sent to the server.
- On first load after upgrade, any legacy `wenger.submissions.v1`
  entries are **backfilled** to Neon once (idempotent on `id`) and the
  key is cleared.

**Cycle 6:** `repId`/`repName` now come from the authenticated session
(NextAuth) — the API no longer trusts client-supplied identity. Reps see
only their own submissions; admins are scoped the same on `/submissions`
(the admin "see all" view ships in Cycle 7). No edit/delete or photo
upload yet.

**Cycle 10:** reps can **edit and delete their own** submissions and
admins **any** submission — Edit/Delete on the `/submissions` list and
`/submissions/[id]` detail (rep) and the `/admin` Submissions expandable
row (admin). Editing reuses the visit form, prefilled, at
`/submissions/[id]/edit`; `PATCH` + `DELETE /api/submissions/[id]`
enforce owner-or-admin server-side (an admin edit never reassigns the
row's rep). Deletes go through the in-app confirm modal.

**Cycle 13 — photo attachments:** reps can attach up to 20 photos per
visit (soft warning at 15). The form's Photos section uses the native
camera (`<input capture="environment">`); each shot is compressed in a
Web Worker (≤1600px long edge, JPEG q0.8, ~1MB) and queued in
IndexedDB as a `LocalPhotoRow`. The two-phase sync engine drains
submissions first, then photos; the photo upload uses
`@vercel/blob/client.upload()` direct-to-Vercel-Blob via the
`/api/photos/upload` `handleUpload` route. Photos are stored
**private**; browser reads stream through `/api/photos/[id]/file`
gated by the same owner-or-admin matrix as `/api/submissions/[id]`.
Soft-delete via `deleted_at` (orphaned blob bytes reaped in a future
cleanup pass). Photo retries cap at 5 attempts → terminal `failed`
with a manual Retry button. The Submissions tab badge counts photos
too, and the sync-status strip on `/submissions` reads
"⏳ N pending sync · M photo(s) uploading" when both are active.

### Project conventions

See `CLAUDE.md` for the full project rules. Highlights:

- Mobile-first. Test 375px width before anything else.
- Wenger navy `#0A3758` is the brand color. Warm `#b8612a` for "priority" highlights only.
- Build in cycles. Every cycle ships to production.

### Cycle workflow

1. Open `CLAUDE.md`, read the current cycle's scope
2. Run the pre-cycle checklist (defined in `CLAUDE.md`)
3. Execute the cycle
4. Run the end-of-cycle checklist
5. Commit, push, verify Vercel deploy, update `CHANGELOG.md`

---

## For users

**Live app:** https://valkolimark-wenger-field-notes.vercel.app
(custom domain deferred — runs on the `vercel.app` URL for now).

- **Team onboarding:** [`docs/LAUNCH.md`](docs/LAUNCH.md) — how reps
  log in (temp password, force-change), the four screens, troubleshooting.
- **Admin runbook:** [`docs/ADMIN.md`](docs/ADMIN.md) — reset/add/remove
  users, reassignment, AI summaries, `SEED_PASSWORD`, infra access.

Cycle 9 (Polish & launch) shipped: system sans-serif throughout,
accessible button hierarchy, toast/confirm system, loading skeletons,
empty states, and error boundaries on every screen.

Cycle 10 added **edit & delete for submissions** (reps: own; admins:
any) and refreshed the in-app header with the official Wenger brand
wordmark.

Cycle 11 made the app an **installable standalone PWA** — Add to Home
Screen on iOS/Android for a native-feeling, full-screen experience
(Wenger-navy chrome, notch/home-indicator safe, app icon). The header is
now layout-aware (edge-to-edge on the full-bleed map, boxed elsewhere).

Cycle 12 made the app **offline-first**. Drafts and saved visits live
in IndexedDB on the rep's phone; a finished visit shows in My
Submissions immediately with a "Pending sync" badge and syncs to the
server when connectivity returns — automatically (on app open, on
reconnect, every 60s while open) or via the **Sync now** button at the
top of My Submissions. Pending visits can still be edited or deleted
offline (deleting a pending visit removes it before it ever reaches the
server). A small numeric badge on the My Submissions tab shows the
pending count from anywhere in the app. The map's California tiles
(zoom 8–14) are cached too, so dead zones still show the map and
school pins on the installed PWA.

Cycle 13 added **photo attachments and vision-aware AI summaries**.
The visit form gained a Photos section with native camera capture —
tap **Add photo**, the phone camera opens, the thumbnail appears
instantly with a captioning sheet. Photos persist locally through
dead zones (status: Pending) and upload to Vercel Blob automatically
when connectivity returns (status: Uploading → done; failures retry up
to 5 times, then offer a manual Retry). Up to 20 photos per visit
(soft warning at 15). The submission tab badge now counts photos too,
so a photo-only queue is visible from any screen. Submission detail
(rep + admin) renders a photo grid with a tap-to-zoom lightbox; the
Vercel Blob store is private, so all reads stream through a server-
side proxy gated by the existing owner-or-admin rules. AI summaries
are now vision-aware: Pipeline and Per-rep summaries see every
photographed detail; the new **Deep analysis** button on each admin
row produces a per-visit summary that calls out what the photos show.

---

## License

Proprietary — Wenger Corporation. Not for external distribution.
