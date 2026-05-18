# Next Session Kickoff — Cycle 10+ (post-launch iteration)

Paste the block below as the first message of a fresh Claude Code session to
start the next round of work. It is faithful to the requested features and
carries forward the constraints learned across Cycles 1–9.

---

```
Wenger Field Notes — post-launch iteration (Cycle 10+).

First, follow CLAUDE.md cycle discipline: read CLAUDE.md, CHANGELOG.md,
README.md, docs/ADMIN.md, docs/LAUNCH.md, run the full pre-cycle checklist,
then restate objective/scope/done and WAIT for my "proceed" before any code.

CLAUDE.md says one feature slice per cycle — the work below is ~2 cycles.
Propose the slicing yourself (I expect: Cycle 10 = submission edit/delete;
Cycle 11 = PWA/responsive + adaptive header) and confirm with me.

WORK TO DO

1. Edit & delete submissions
   - Field reps can EDIT and DELETE their OWN submissions.
   - Admins can EDIT and DELETE ANY submission.
   - Reuse the existing visit form for editing (prefilled).
   - Delete uses the existing useToast().confirm() modal (no window.confirm).
   - Entry points: rep side on /submissions (+ /submissions/[id]); admin side
     on the /admin Submissions tab (expandable detail row).
   - Permissions enforced SERVER-SIDE on every mutating route (defense in
     depth, same pattern as requireAdmin()): rep scoped to own rows by
     session repId; admin may act on any. Add PATCH + DELETE for
     /api/submissions/[id] (currently GET-only, session-scoped) and the
     admin equivalent. Validate body the same way POST /api/submissions does.

2. PWA / mobile homescreen polish
   - When the app is installed to the homescreen / runs standalone as a PWA,
     there must be NO overlap, nothing offscreen, and no resizing glitches —
     it must feel as smooth as a native app.
   - Add/verify a proper web app manifest (standalone display, start_url,
     scope, theme-color = Wenger navy #0A3758, icons), viewport-fit=cover,
     and safe-area-inset handling (notch + home indicator) so the navy
     header and the Map/My Submissions tab bar never collide with the OS
     status bar or home indicator.
   - Test at 375px AND installed standalone (iOS Add to Home Screen +
     Android). Flag any new dependency before adding it.

3. Adaptive header alignment
   - On FULL-WIDTH layout pages: the Wenger logo goes all the way to the
     far LEFT edge and the user name / navigation goes all the way to the
     far RIGHT edge.
   - On BOXED / constrained-layout pages: keep the CURRENT behavior (logo
     and controls aligned to the boxed content width — unchanged).
   - Make the header layout-aware; identify which routes are full-width vs
     boxed and drive it from that, don't hardcode per page.

CARRY THESE GUARDRAILS (learned the hard way — don't relearn them)
   - Resolve the current user by session.user.repId, NEVER by email
     (email is mutable; this caused a real 404 bug in Cycle 6.5).
   - Do NOT touch the JWT type-augmentation casts in src/lib/auth.ts
     (token.x as Type) — flaky NextAuth v5 beta workaround, leave as-is.
   - drizzle-orm/neon-http has NO interactive transactions — use
     db.batch([...]) for any multi-statement atomicity (e.g. delete flows).
   - Reuse existing primitives: <Button>/buttonClass() (variants
     primary/secondary/destructive/ghost — destructive red is #B42318,
     NEVER the warm priority accent #b8612a), useToast() (success/error +
     confirm()), <Skeleton>/RowsSkeleton/FormSkeleton, <ErrorState>, and
     add route loading.tsx/error.tsx for any new screens.
   - Mobile-first, test 375px first. Brand navy #0A3758; warm #b8612a for
     priority highlights ONLY. System sans everywhere (no serif/font-display
     — that token was removed in Cycle 9).
   - Secrets: don't commit them; Sensitive env vars (DATABASE_URL,
     AUTH_SECRET, SEED_PASSWORD, ANTHROPIC_API_KEY) live only on Vercel and
     are NOT vercel-env-pull-able; do NOT run `vercel env pull` (it clobbers
     .env.local). Server-only API keys never in client code.
   - DB testing: tag temp data, clean up precisely, and restore the DB to
     EXACT seed afterward (7 users; only mark.mireles has a password set;
     submissions = BHrdlichka:1). Mark's account has a private password the
     user set deliberately — do NOT reset/overwrite it during testing; use
     bootstrap users (jackie / rakhi / tam) for destructive auth tests, with
     temp password_updated_at clear+restore.
   - No new dependencies or env vars or schema migrations without flagging
     them in the cycle summary. Checkpoint-commit each meaningful step.

END OF CYCLE: build clean, test live at
https://valkolimark-wenger-field-notes.vercel.app after Vercel auto-deploy,
update CHANGELOG.md (and README.md if user-facing), run the end-of-cycle
checklist, announce shipped.
```
