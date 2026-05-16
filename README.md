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
- **Cycle 5+:** `DATABASE_URL` (auto-injected by Vercel Neon integration locally via `vercel env pull`)
- **Cycle 6+:** `AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`
- **Cycle 8+:** `ANTHROPIC_API_KEY`

### Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Leaflet + react-leaflet (OpenStreetMap tiles) · lucide-react · Neon Postgres · Drizzle ORM · NextAuth v5 · Anthropic SDK · Deployed on Vercel.

### Data

School data is **static** — no runtime geocoding or external API. The 47
schools live in `src/lib/schools.ts` (`Tier` union, `TIER_LABELS`, `School`
interface, `schools` sorted by name). Coordinates are hand-derived from the
source addresses; a few ambiguous ones are marked `// TODO: verify coords`.
Source of record: `docs/California Private School- LA and Architects.docx`.
The interactive map uses Leaflet with free OpenStreetMap tiles (no API key).

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
