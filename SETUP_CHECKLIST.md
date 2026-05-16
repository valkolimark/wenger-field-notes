# Setup Checklist — Accounts & Vercel

Everything you need to set up **before and during** Cycle 1, in the order you'll need it. Items marked **[NOW]** are needed for Cycle 1. Items marked **[LATER]** can wait until the cycle that uses them.

---

## [NOW] Local machine

- [ ] **Node.js 22 LTS** installed — [nodejs.org](https://nodejs.org). Verify: `node --version` shows v22.x.
- [ ] **Git** installed — [git-scm.com](https://git-scm.com/downloads). Verify: `git --version` returns a version.
- [ ] **GitHub CLI** installed — [cli.github.com](https://cli.github.com) (optional but recommended; makes repo creation one command). Verify: `gh --version`.
- [ ] **VS Code** installed — [code.visualstudio.com](https://code.visualstudio.com).
- [ ] **Claude Code** installed:
  - macOS/Linux: `curl -fsSL https://claude.ai/install.sh | bash`
  - Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`
  - Verify: `claude --version`. First run of `claude` in any folder opens browser for OAuth login.

## [NOW] GitHub

- [ ] **GitHub account** at [github.com](https://github.com). Free is fine.
- [ ] After installing GitHub CLI, run `gh auth login` and authenticate.
- [ ] You do NOT need to create the `wenger-field-notes` repo yet — Claude Code will do that in Cycle 1 via `gh repo create`.

## [NOW] Vercel

- [ ] **Vercel account** at [vercel.com](https://vercel.com). Sign up with your GitHub account (easiest — auto-links permissions).
- [ ] Stay on **Hobby plan** ($0/month). You can upgrade later if you need a custom domain on production or more team seats.
- [ ] No project to create yet — Cycle 1 imports the GitHub repo and creates the Vercel project automatically.

## [NOW] Workspace folder

- [ ] Decide where on your machine the project will live (e.g. `~/Projects/wenger-field-notes`).
- [ ] Create that folder. `cd` into it.
- [ ] Place these three files in the folder:
  - `CLAUDE.md` (the project instructions)
  - `README.md`
  - `CHANGELOG.md`
  - `CYCLE_1.md` (the cycle prompt — you'll paste from this into Claude Code)
- [ ] Create a `public/` subfolder. Place the two Wenger logos:
  - `public/logo-white.png` (white logo, transparent background)
  - `public/logo-blue.png` (blue logo, transparent background)
  - _I'll deliver these to you below — download from the file panel._

## [NOW] Anthropic Console (for Claude Code itself)

You need this even for Cycle 1, because Claude Code authenticates against an Anthropic account.

- [ ] Account at [console.anthropic.com](https://console.anthropic.com).
- [ ] **Option A (recommended for starting out):** Claude Pro subscription ($20/month). Claude Code authenticates via your Pro account, no API key juggling. Good usage limits.
- [ ] **Option B:** API credits ($5-10 to start). Claude Code uses your API key. Pay-per-use.
- [ ] Either way, set a monthly spending limit in Console → Settings → Limits → $50/month as a safety net.

---

## [LATER] Cycle 5 — Database

- [ ] In Vercel project dashboard → **Storage tab** → **Create Database** → **Neon Postgres** (it's a Marketplace integration, free tier covers our needs).
- [ ] Vercel auto-injects `DATABASE_URL` and related env vars into the project. No manual config.
- [ ] Locally, run `vercel env pull .env.local` to sync env vars to your machine.

## [LATER] Cycle 6 — Email magic-link authentication

- [ ] **Resend account** at [resend.com](https://resend.com). Free tier = 3,000 emails/month, plenty for a 6-person team.
- [ ] Verify a sending domain (or use Resend's `onboarding@resend.dev` for testing).
- [ ] Get API key from Resend dashboard. Add to Vercel env vars as `RESEND_API_KEY`.
- [ ] Set `EMAIL_FROM` env var to your verified address.
- [ ] Generate `AUTH_SECRET`: run `openssl rand -base64 32` in terminal, add result to Vercel env vars.

## [LATER] Cycle 8 — Claude AI summaries

- [ ] Anthropic API key from [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key.
- [ ] Add to Vercel env vars as `ANTHROPIC_API_KEY`.

## [LATER] Cycle 9 — Custom domain (optional)

- [ ] If you want `fieldnotes.wenger.com` instead of `wenger-field-notes.vercel.app`:
  - Vercel Pro plan ($20/month) required for custom domains on production
  - DNS access at Wenger's domain registrar
  - In Vercel project → Domains → Add → follow DNS instructions

---

## How to use Vercel for this project (the basics)

**Auto-deploy from GitHub.** Once Vercel is linked to your repo in Cycle 1, *every push to the `main` branch automatically builds and deploys.* You'll never manually deploy. Push code → wait ~90 seconds → live.

**Preview deploys on branches.** If you ever work on a branch (e.g. `cycle-7-admin`), Vercel automatically creates a preview deployment at a unique URL. Test changes safely before merging to main.

**Environment variables live in two places:**
- Locally: `.env.local` (gitignored, never committed)
- On Vercel: Project Settings → Environment Variables (set per environment: Production / Preview / Development)
- Run `vercel env pull` to sync from Vercel to local. Run `vercel env add` to add a new one from CLI.

**Vercel dashboard daily routine after a cycle:**
1. Open vercel.com → your project
2. Confirm the latest deploy shows "Ready" with green check
3. If it shows "Error", click in for build logs
4. Click the live URL to verify the feature works

---

## When you're ready to start Cycle 1

1. All [NOW] items above ✅
2. Open a terminal in your project folder
3. Run `claude` to start Claude Code
4. Paste the entire contents of `CYCLE_1.md` as your first message
5. Claude Code runs the pre-cycle checklist, restates the plan, waits for your approval
6. Type "proceed" — Cycle 1 executes
7. Follow Claude Code's prompts; it will tell you when to do the Vercel import step in the browser
8. Cycle 1 ends with a live URL — verify, celebrate, take a break, plan Cycle 2

---

## What it costs to be at "Cycle 1 deployed"

| Item | Cost |
|------|------|
| Domain (no custom domain yet) | $0 |
| Vercel Hobby | $0 |
| GitHub free | $0 |
| Claude Pro subscription (recommended for Claude Code) | $20/month |
| **Total to ship Cycle 1** | **$20/month** |

Costs grow as you turn on services in later cycles, but a fully production-ready app for 6 reps with AI summaries lands at ~$25-45/month total.
