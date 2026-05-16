# Changelog

All notable changes per cycle. Newest at top.

Format: `## Cycle N — Title (YYYY-MM-DD)` followed by a short prose summary, then bullet lists for Added / Changed / Fixed / Notes.

---

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
