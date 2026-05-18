# Wenger Field Notes — Admin Runbook (Mark & Jackie)

Admins: `mark.mireles@wengercorp.com`, `jackie.berg@wengercorp.com`.
Admin tools live at **/admin** (the **Admin dashboard** item in the
top-right menu; only admins see it).

URL: https://valkolimark-wenger-field-notes.vercel.app

## Submissions (Admin → Submissions tab)

- See **every rep's** visits. Filter by rep with the dropdown.
- Tap a row to expand the full visit detail.
- **Export CSV** downloads the current view (respects the rep filter)
  as a spreadsheet-ready file.

## AI summaries (Admin → Submissions tab)

- **Summarize pipeline** — Claude analyzes the whole team's visits and
  streams a structured summary.
- Select a rep in the filter, then **Per-rep summary** — same, for
  that one rep.
- **Regenerate** re-runs it; **Close** dismisses. Nothing is saved —
  it's generated fresh each time.

## User management (Admin → Users tab)

**Add a user:** Users tab → **Add user** → enter email, name, repId
(e.g. `JSmith`), role (rep/admin) → **Create user**. They get the
bootstrap password and must change it on first login.

**Reset a user's password:** find the user → **Reset password** →
confirm. They log in next with the bootstrap password and are forced
to choose a new one. Use this when someone is locked out.

**Edit a user:** **Edit** → change name / email / repId / role →
**Save**. Notes:
- You **can't change your own role** (prevents accidental lockout).
- A user's repId **can't be changed while they have submissions** —
  reassign via delete instead (below), or leave repId as-is.

**Remove a user:** **Delete**.
- 0 submissions → confirm → done.
- Has submissions → a dialog asks you to either **reassign** them to
  another user (dropdown) or **delete the user and all their
  submissions**. Either way it's atomic (all-or-nothing).
- You **can't delete yourself**.

## The bootstrap password (`SEED_PASSWORD`)

- New users and password resets are set to a shared bootstrap password:
  **`Wenger2026!`**. The user is always force-changed on next login, so
  it's never their real password.
- It lives as a **Sensitive environment variable** on Vercel, never in
  the code. Keep it known to admins only.
- If it ever needs rotating, change it in the Vercel project settings.
  Note: that only affects *future* adds/resets — it does not change
  anyone's existing chosen password.

## Infrastructure access

- **Vercel** (hosting/env) — project `valkolimark-wenger-field-notes`.
  Env vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`,
  `SEED_PASSWORD`, `ANTHROPIC_API_KEY` (all Sensitive). Mark owns
  access; coordinate with him for any env/infra change.
- **Neon** (Postgres database) — submissions + users live here.
- A custom domain is **not** set up yet (the app runs on the
  `vercel.app` URL); that's a planned post-launch follow-up.
- Code: GitHub `valkolimark/wenger-field-notes`, auto-deploys on push
  to `main`.
