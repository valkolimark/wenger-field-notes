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
- **Cycle 8+:** `ANTHROPIC_API_KEY`

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

### Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Leaflet + react-leaflet (OpenStreetMap tiles) · lucide-react · Neon Postgres · Drizzle ORM · NextAuth v5 · Anthropic SDK · Deployed on Vercel.

### Data

School data is **static** — no runtime geocoding or external API. The 47
schools live in `src/lib/schools.ts` (`Tier` union, `TIER_LABELS`, `School`
interface, `schools` sorted by name). Coordinates are hand-derived from the
source addresses; a few ambiguous ones are marked `// TODO: verify coords`.
Source of record: `docs/California Private School- LA and Architects.docx`.
The interactive map uses Leaflet with free OpenStreetMap tiles (no API key).

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

## For users (added in later cycles)

_To be written in Cycle 9 — Launch._

---

## License

Proprietary — Wenger Corporation. Not for external distribution.
