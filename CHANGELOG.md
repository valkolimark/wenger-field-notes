# Changelog

All notable changes per cycle. Newest at top.

Format: `## Cycle N — Title (YYYY-MM-DD)` followed by a short prose summary, then bullet lists for Added / Changed / Fixed / Notes.

---

## Cycle 17 followup — VisitFormResolver renders skeleton until URL resolves (2026-05-22)

The initial Cycle 17 fix replaced `useParams()` with
`readUrlSegment(...)` directly inside the render. On the server side
(no `window`), `readUrlSegment` returned the empty fallback —
which made `schools.find()` return `undefined` and rendered "School
not found" into the cached HTML. Reps saw "School not found" the
moment they tapped any school offline (faster than the hydrated
client re-render could correct it) and bounced back to the menu.

**Fix:** defer the URL read to `useEffect`. The component starts
with `schoolId: null`, renders `<FormSkeleton/>` (school-agnostic).
After mount, `useEffect` reads `window.location.pathname` and
sets the real schoolId; the form renders. The cached HTML is now
the skeleton — works for every URL, no school baked in.

`<EditSubmission>` and `<SubmissionDetail>` already had a loading
state (`status === "loading"` shows a skeleton) so their version
of the URL-bar fix was unaffected — the load callback re-runs with
the corrected id and they show the right submission.

Also bumped SW `PAGES_CACHE` v5 → v6 and `RSC_CACHE` v5 → v6 so
existing devices abandon any cached "School not found" HTML from
the brief initial-fix window and the new install repopulates with
the skeleton.

**Changed**
- `<VisitFormResolver>` rewritten with `useState` + `useEffect`
  + `<FormSkeleton/>` placeholder. Imports `FormSkeleton` from
  `@/components/ui/skeleton`. `popstate` listener handles back/
  forward nav (pushstate-driven nav within the page already
  re-mounts via the App Router).
- `src/app/sw.ts` cache versions bumped to v6.

Build clean (27 routes, unchanged). tsc --noEmit clean. Live
`public/sw.js` carries `pages-v6` + `next-rsc-v6`.

## Cycle 17 — Offline wrong-school bug fix (URL bar as source of truth) (2026-05-22)

**Field report after Cycle 16:** a rep opened Brentwood online, went
offline, force-quit, reopened, tapped Fairmont Prep, started a visit
— the **Brentwood** form came up, and submitting saved the visit as
**Brentwood**. The wrong-school submission is the data-corruption
half of a deeper bug.

**Root cause.** The Cycle 12 `/form/*` and Cycle 16 `/submissions/*`
SW prefix fallbacks serve ONE cached HTML/RSC entry for every URL
matching the pattern. Cycle 12's design relied on `useParams()` in
the client resolver "picking up the actual current schoolId at
render time." That assumption is wrong for the cached-fallback case:
useParams() reads from the App Router's route tree, whose segment
params come from the (offline-cached) RSC payload — not the URL bar.
When the SW serves `/form/<brentwood>` HTML+RSC for a `/form/<fairmont>`
URL, useParams returns `"brentwood"`, the resolver looks up
Brentwood's school, the form renders Brentwood, the save handler uses
`school.id = "brentwood..."`, and the rep's "Fairmont" visit lands in
the DB as a Brentwood visit. Same risk applies for Cycle 16's
`/submissions/__prefetch__` template: the prop chain feeds the
placeholder id into EditSubmission / SubmissionDetail, masking the
real id from the URL.

**Fix: URL bar as source of truth.** New helper
`src/lib/url-id.ts → readUrlSegment(pattern, fallback)` reads
`window.location.pathname` on the client (the post-hydration URL,
which is always what the rep tapped) and falls back to the caller-
supplied value during SSR. Applied to all three dynamic-route
client resolvers:

- `<VisitFormResolver>` — drops `useParams()`. Reads schoolId via
  `readUrlSegment(FORM_SCHOOL_ID_PATH, "")`. Same `schools.find()`
  lookup downstream, so the form + the save handler's `school.id`
  both reflect the URL bar.
- `<EditSubmission>` — keeps the `id` prop in the signature (SSR
  still needs a value), but the body reads
  `readUrlSegment(SUBMISSION_ID_PATH, idFromProps)` and uses THAT
  for the load() callback + everywhere downstream.
- `<SubmissionDetail>` — same change as EditSubmission.

**What this DOES NOT change:** the SW behavior, the prefetch lists,
the cache versions, or any other Cycle 16 plumbing. The fallbacks
still serve cached HTML for every matching URL — they just no longer
mislead the client component about which id the rep tapped. A brief
hydration mismatch (server-rendered HTML has the cached id; client
re-render shows the URL bar's id) is acceptable because: (a) React
patches up the subtree on mismatch, and (b) the SAVE PATH uses the
client-resolved id, so a wrong-school submission cannot be created
even if the heading text flickers for one paint.

**Added**
- `src/lib/url-id.ts` — `readUrlSegment(pattern, fallback)` plus
  pre-compiled `FORM_SCHOOL_ID_PATH` and `SUBMISSION_ID_PATH`
  regexes. Captures the dynamic segment as group 1; safely decodes.

**Changed**
- `<VisitFormResolver>` — `useParams()` import + read replaced by
  `readUrlSegment(FORM_SCHOOL_ID_PATH, "")`.
- `<EditSubmission>` — id prop renamed to `idFromProps` (kept for
  SSR fallback); body uses `readUrlSegment(SUBMISSION_ID_PATH, ...)`.
- `<SubmissionDetail>` — same change.

**Notes / verification**
- Zero new dependencies, zero env vars, zero schema migrations, no
  SW changes (no cache version bump needed — only client component
  behavior changes).
- `npm run build` clean (27 routes, unchanged). `tsc --noEmit` clean.
- **Team's portion of the live check (the bug repro):** open online,
  look at one school (e.g. Brentwood). Airplane mode → force-quit →
  reopen. Tap a DIFFERENT school (e.g. Fairmont Prep). Form should
  open with Fairmont's name; saving should produce a Fairmont
  submission, not a Brentwood one. Same for opening a different
  pending submission's detail and edit views.
- Live: https://valkolimark-wenger-field-notes.vercel.app

## Cycle 16 — Offline route coverage extension (2026-05-21)

Field feedback after Cycle 15:
1. **"Couldn't load submissions — pull to refresh."** — too cryptic;
   reps didn't know it was a connectivity warning, not a server bug.
2. **"I had to go to the form while online before it showed up."** —
   the Cycle 15 install-time `/form/<sample>` prefetch wasn't enough
   on its own.
3. **"I was not able to edit my entry offline."** — same Cycle 14
   regression manifesting for a different route: `/submissions/<id>/edit`
   isn't precached and has no SW prefix fallback, so it fell through to
   cached `/map`.
4. Overall ask: "I need the PWA to completely pull down all pages to
   work properly offline."

**Root cause for (2):** the SW install handler used
`if (res.ok || res.redirected) cache.put(...)`. If install fired
before the auth cookie reached the SW, middleware redirected
authed-only routes to `/` and the install handler cached the LOGIN
page HTML under the original URL — including `/form/<sample>`,
`/map`, `/submissions`, `/account`. Subsequent offline navs to any
of those URLs served the login page HTML. The `PrefetchOfflineRoutes`
post-auth re-fetch overwrote them, but only after the rep navigated
somewhere that triggered it. Reps who tapped Start visit before that
re-fetch landed got the login HTML instead of the form, which
browsers render as `/` (the school list felt like a "bounce back").

**Root cause for (3):** Cycle 12's `/form/*` prefix-fallback machinery
in the SW navRoute only matches `/form/*` URLs. `/submissions/[id]`
and `/submissions/[id]/edit` are dynamic routes with identical
server-rendered HTML across all ids (same trick as `/form`), but
they were never prefetched and the navRoute had no fallback
matcher for them. Offline tap-Edit hit the navRoute, missed
everywhere, and fell through to cached `/map`.

**Fixes**

- `<UseSubmissions>` server-fetch error string extended:
  `"Couldn't load submissions — pull to refresh. Make sure you're
  online and have signal."`
- `src/app/sw.ts` install handler: `if (res.ok && !res.redirected)`
  for both pages-cache and rsc-cache puts. Same guard added to the
  `message` (post-auth client→SW) handler. Stops login-page HTML
  from poisoning authed-route cache keys.
- `PREFETCH_NAV` extended with two placeholder URLs:
  `/submissions/__prefetch__` (detail template) and
  `/submissions/__prefetch__/edit` (edit template). The server
  renders identical HTML for any id (the client component reads
  useParams() and loads the row from the API or Dexie), so these
  single entries satisfy the SW nav fallback for every real id
  offline.
- `<PrefetchOfflineRoutes>` (post-auth client→SW PREFETCH message)
  list extended with the same two URLs — the install pass IS the
  primary seed, but the client pass overwrites with fresher
  authed HTML on every shell mount.
- New SW helper `fallbackByMatcher(cacheName, url, matcher)`
  generalizes the old `fallbackByPrefix` to accept a predicate.
  Three matchers shipped: `IS_FORM_PATH` (existing /form/*),
  `IS_SUBMISSION_EDIT_PATH` (`/^\/submissions\/[^/]+\/edit$/`,
  checked first because it's more specific), and
  `IS_SUBMISSION_DETAIL_PATH` (`/^\/submissions\/[^/]+$/`).
  navRoute + rscRoute both call `fallbackByAnyMatcher(...)` which
  walks the chain in order; each matcher requires BOTH the
  requested URL and the cached key to satisfy it (so a
  /form/<id> request can never accidentally pick up a cached
  /submissions/<id> entry).
- Cache versions bumped: `pages-v4 → pages-v5`, `next-rsc-v4 →
  next-rsc-v5`. Forces existing devices to re-run the install
  handler with the new prefetch list + redirect-skip behavior, and
  abandons any login-page-poisoned entries from before the fix.

**Notes / verification**
- Zero new dependencies, zero env vars, zero schema migrations.
- `npm run build` clean (27 routes, unchanged). `tsc --noEmit`
  clean. Built `public/sw.js` carries `pages-v5`, `next-rsc-v5`,
  `submissions/__prefetch__`, and `submissions/__prefetch__/edit`
  — verified inline.
- **Team's portion of the live check (iOS PWA):** open online for
  ~15s (let the v5 SW install + prefetch complete). Force-quit,
  airplane mode, reopen. Tap any pin → form should open immediately,
  no prior online form visit required. On `/submissions`, tap a
  pending row → detail opens. Tap Edit → edit page opens. None of
  these should bounce to `/map` anymore.
- Live: https://valkolimark-wenger-field-notes.vercel.app

## Cycle 15 — Map view restored + offline form prefetch fix (2026-05-21)

Two slices in one cycle (user-approved at the gate):

1. **Map view restored.** Hand-derived `lat`/`lng` for all 39 schools
   from their `location` strings (LA-area knowledge; same Cycle 3
   pattern). Recreated `<SchoolMap>` (Leaflet pins + navy divIcon +
   OSM tiles, deleted in Cycle 14). `<MapScreen>` now renders the
   map by default and gains a Map/List toggle so reps can switch to
   the Cycle-14 tier-grouped list when scanning by name is faster.
   The Cycle 14 "Coordinates pending" banner is gone.

2. **Offline form regression fixed.** Cycle 14's cache version bump
   emptied `pages-v3`, but the SW install handler's `PREFETCH_NAV`
   never included a `/form/<id>` URL — only the async post-auth
   client→SW prefetch did. If a rep went offline before that prefetch
   completed, the navRoute's `/form/*` prefix fallback would miss
   and fall all the way through to cached `/map`, sending the rep
   back to the school list instead of the form (matches the
   reported symptom exactly).

**GATE decisions (approved):**
- **Map + List toggle** rather than map-only or map-with-list-below.
  Default = map; small Map/List pills in a toolbar row beneath the
  search bar.
- **Commit best-guess coordinates with `// TODO: verify coords` on
  the ambiguous ones; user spot-checks live.** Same pattern Cycle 3
  used. 5 entries flagged: Oakwood (Secondary/Elementary multi-
  campus), Wildwood (same), Sequoyah (K-8/HS split), Le Lycée
  Français (distributed campuses), Turning Point (location string
  says Culver City but Sylvan St address resolves to Van Nuys —
  pinned at the literal address).

**Added**
- `lat: number` + `lng: number` (required) on the `School` interface;
  39 coordinates populated in `src/lib/schools.ts`.
- `src/components/map/school-map.tsx` (restored) — Leaflet
  MapContainer + custom navy divIcon pin + InvalidateOnReady, same
  shape as the Cycle 3 file deleted in Cycle 14.
- Map/List toggle (compact 2-button pill row) in `<MapScreen>`,
  rendered between the SearchFilter and the view area.

**Changed**
- `<MapScreen>` — dynamic-import `<SchoolMap>` (ssr:false because
  Leaflet touches `window`); render map OR list based on the toggle.
  Preview overlay sits as a sibling of the view area, inside the
  outer `fixed` container, so it pins to the visible viewport in
  both views.
- `<EditSubmission>` — fallback `School` literal (used when the
  schoolId no longer matches any current row) gains `lat`/`lng`
  defaults at LA-area centroid so the type stays satisfied.
- `src/app/sw.ts`:
  - Imports `schools` (bundled into the worker; +~30KB sw.js).
  - `PREFETCH_NAV` extended with `\`/form/\${schools[0].id}\`` —
    `/form/[schoolId]` HTML is identical for every school (the
    resolver reads useParams() client-side), so caching ONE form URL
    satisfies the navRoute's `/form/*` prefix fallback for every
    other school.
  - `PAGES_CACHE` bumped v3 → v4 and `RSC_CACHE` v3 → v4 so existing
    devices re-run the install handler (which now seeds the form URL).

**Notes / verification**
- Zero new dependencies (`leaflet` + `react-leaflet` were retained
  in package.json across Cycle 14 for exactly this restoration).
  Zero new env vars, zero schema migrations.
- `npm run build` clean (27 routes, unchanged). `tsc --noEmit` clean.
  Public `public/sw.js` carries `pages-v4`, `next-rsc-v4`, and the
  bundled `schools[0].id` (`brentwood-school-east-campus-6-12`)
  resolved at SW install time. SW bundle grew ~40KB → ~71KB.
- **Coordinate spot-check is the team's portion of the live check.**
  Drop into `/map`, see the 39 pins, tell me which (if any) are
  noticeably off — I correct in a follow-up. The 5 `// TODO: verify
  coords` entries are the most likely candidates.
- Live: https://valkolimark-wenger-field-notes.vercel.app

## Cycle 14 — School dataset swap to Brooke's May-2026 planning sheet (2026-05-21)

Replaced the entire school dataset with the authoritative California
private-school list from Brooke's `California_Planning.xlsx` (May 2026).
Dropped from ~47 entries to **39 schools** across **4 tiers**; added
two new fields per record (`contacts: SchoolContact[]` and `notes`);
collapsed `address`+`city` into a single `location` string; **removed
`lat`/`lng`** (a future geocoding cycle will re-introduce coordinates).

This is a data + types change, not a redesign — Brooke's visit-form
redesign (contact-first layout, project/needs timeline, decision-maker
+ vendors + dealers + co-ops + funding source, marketing channels with
nested socials, removal of "estimated opportunity size") is deferred
to a dedicated form cycle. The `contacts` field added here is the
data foundation that future form's contact selector will use.

**GATE decisions (approved at proceed):**
- **Proceeded from a non-clean working tree** — the new `schools.ts`
  was pre-pasted on disk with an `old_schools.ts` backup. Used the
  pre-pasted file as the source of truth; removed the backup at
  Checkpoint A.
- **Wiped `submissions` + `photos` tables in the live Neon database.**
  Authorized: the app is in development, the new schools use a fresh
  `id` scheme (kebab-slug of the new names), and otherwise every
  prior submission would be orphaned to a deleted parent. No
  schema/users/auth changes. Verified `count(*) === 0` on both.
  7-row `users` table untouched.

**Spec follow-through (flagged):**
- **Map can't pin the new dataset** (no lat/lng). Per spec, did NOT
  invent coordinates. Replaced the Leaflet map on `/map` with a
  tier-grouped scrollable list + a "Coordinates pending" banner.
  Same chrome (search + tier-pill filter); tapping a row still opens
  the existing `<SchoolPreview>` with the Start visit CTA. The route
  is intentionally named `/map` so the SW prefetch + tab bar wiring
  don't move; the map view returns when the geocoding cycle lands.

**Added**
- `src/lib/schools.ts` — 39 schools, 4 tiers (10/8/11/10), with
  `id`, `name`, `tier`, `location`, `enrollment`, `projectActivity`,
  `contacts: { role, name }[]`, `notes`. New `SchoolContact` and
  `SCHOOL_TIERS` (tuple, canonical display order) exports.
- `src/components/map/school-list.tsx` — tier-grouped, alphabetized
  within each tier; preserves the existing `<SchoolPreview>` flow on
  selection; "no match" empty state.

**Changed**
- `<MapScreen>` — Leaflet `<SchoolMap>` swapped for `<SchoolList>` +
  a one-line "Map coordinates are coming…" info banner. Preview
  overlay moved out of the scrolling region so it pins to the visible
  viewport, not scroll-bottom.
- `<SearchFilter>` — `TierFilter` is now `SCHOOL_TIERS[number] |
  "all"`; pill keys hold the full canonical tier strings; pill labels
  stay short ("Tier 1", "Core", "Catholic", "Expanded").
- `<SchoolPreview>` — dropped `TIER_LABELS`; tier badge renders the
  canonical string directly. "Address" → "Location" (single
  `whitespace-pre-line` string). New Contacts list + Background block
  (read-only, hidden when empty).
- `<SubmissionDetail>` — header location line uses `school.location`.
  Two new collapsed-by-default sections: **School contacts** (role +
  name list) and **Background** (school notes), hidden when empty.
- `<SubmissionsList>` — replaced `CITY_BY_ID` with `LOCATION_BY_ID`
  (first line of `location` for the row-hint).
- `<EditSubmission>` — fallback `School` literal updated to the new
  shape (tier, location, contacts, notes). Comments why: schools may
  be removed between when a submission was logged and when it's
  edited (the Cycle 14 swap dropped ~8 entries).
- `<VisitForm>` — header line uses `school.location`.
- `src/app/sw.ts` — bumped `PAGES_CACHE` and `RSC_CACHE` from `v2`
  to `v3` so cached form HTML and submission RSC payloads referencing
  the old dataset get abandoned. New SW starts with empty `pages-v3`
  / `next-rsc-v3` and is repopulated by install prefetch +
  post-auth client→SW prefetch.

**Removed**
- `src/components/map/school-map.tsx` — Leaflet pin map. Orphaned
  after the list fallback. `leaflet`/`react-leaflet` deps kept in
  `package.json` for the future geocoding cycle to re-introduce.
- `src/lib/old_schools.ts` — the pre-paste backup; data lives in
  git history.

**Notes / verification**
- **Zero new dependencies, zero new env vars, zero schema migrations.**
- `npm run build` clean (27 routes, unchanged). `tsc --noEmit` clean.
  Lint surfaces only the three pre-existing
  `react-hooks/set-state-in-effect` / refs-during-render warnings
  carried over from Cycle 12; no new errors from this cycle.
- **Live DB state after wipe:** photos=0, submissions=0, users=7
  (unchanged). Verified inline.
- **Cap counts on the new dataset:** `schools.length === 39`,
  per-tier 10/8/11/10, exactly one school with empty `contacts`
  (Crossroads — its info is in `notes`; expected, not a bug).
- **Out of scope, deferred:**
  - Geocoding — re-introduce `lat`/`lng` for the 39 schools and bring
    back the Leaflet map view.
  - Brooke's visit-form redesign — contact selector backed by the
    new `contacts` field, projects/needs timeline, decision-maker +
    vendors/dealers/co-ops/funding-source restructure, marketing
    channel preferences with nested socials, remove "estimated
    opportunity size" from the priority block.
- Live: https://valkolimark-wenger-field-notes.vercel.app

## Cycle 13 — Photo capture & vision summaries (2026-05-20)

Reps now attach photos to a visit; photos persist through dead zones,
sync to Vercel Blob automatically when connectivity returns, and feed
Claude as vision input on every summary. Built as **one cycle, eight
checkpoints (A–H)** like Cycle 12 — deliberate override of the
"one slice per cycle" rule, user-approved at the proceed gate.

**GATE decisions (approved):**
- **Direct upload** via `@vercel/blob/client.upload()` with a server-side
  `handleUpload` route — file bytes never touch the Next.js function.
- **Soft-delete** for photos: `deleted_at` column flips on DELETE; blob
  bytes intentionally orphaned (future cleanup pass reaps them).
- **Cap 20 / warn at 15** photos per submission, surfaced via toast
  in the visit form and enforced server-side in the summarize route.

**GATE amendments (during build):**
- **Q4 (URL visibility): public-by-URL → PRIVATE store + server-side
  proxy.** The Vercel Blob store provisioned via the dashboard turned
  out to be private (the modern default, not the public-by-URL Q4 gate
  assumed). Rather than flip the store, kept it private and added
  `GET /api/photos/[id]/file` — an owner-or-admin gated proxy that
  streams private bytes via `@vercel/blob.get(url, { access: 'private' })`
  with `Cache-Control: private, max-age=3600`. Claude vision base64-
  encodes server-side instead of consuming a URL. Stronger security
  posture; consistent with `ANTHROPIC_API_KEY` / `DATABASE_URL` /
  `SEED_PASSWORD` all being Sensitive.
- **Q6 (SDK image syntax): non-issue.** `@anthropic-ai/sdk@0.96.0`
  exposes `Base64ImageSource` (the path we use) and `URLImageSource`,
  but no `detail` field — because Claude vision has no OpenAI-style
  detail knob. Image token cost is fixed by resolution; one tier per
  image. SDK stays pinned at 0.96.0.

**Spec deviation (flagged):**
- `LocalPhotoRow.submissionId` is the photo→submission linkage (indexed
  in Dexie), not `photoIds: string[]` on `PendingRow` as the spec
  sketched. Both designs work; the one-way approach is normal-form,
  lets photos and submissions sync independently, and means
  `PENDING_SCHEMA_VERSION` stays at 1 (no on-the-wire change for
  queued submissions).

**Added**
- **Postgres `photos` table** (migration 0002_motionless_doctor_faustus,
  applied to Neon): text PK, denormalized `submission_id`/`rep_id`/
  `school_id` (no FK — string-key convention from `submissions.rep_id`),
  `blob_url` + `blob_pathname`, `caption`, `mime_type`, `file_size`,
  optional `width`/`height`, `taken_at`, `uploaded_at`, `created_at`,
  `deleted_at` (soft-delete). Indexes on `submission_id`/`rep_id`/
  `school_id`. New types `PhotoRow` and `InsertPhoto`.
- **Dexie v2** — third store `photos` (`&id, submissionId, status,
  createdAtLocal`). New `LocalPhotoStatus = pending|uploading|uploaded|
  failed`, `LocalPhotoRow` (Blob + thumbnailDataUrl + status +
  bookkeeping), `PHOTOS_SCHEMA_VERSION = 1`, helpers `enqueuePhoto`/
  `getLocalPhoto`/`getPhotosBySubmission`/`getAllPendingPhotos`/
  `setPhotoStatus`/`updateLocalPhotoCaption`/`deleteLocalPhoto`.
  `DraftRow` gained optional `submissionId` so photos enqueued before
  save reference a known parent across reloads/force-quits.
- **`src/lib/photos.ts`** — `compressForUpload()` (≤1600px long edge,
  JPEG q0.8, target ≤1MB via `browser-image-compression` Web Worker),
  240px thumbnail via canvas, transient `HTMLImageElement` for dims.
  `MAX_PHOTOS_PER_SUBMISSION=20`, `PHOTOS_WARN_THRESHOLD=15`.
- **`<PhotoStrip>` + `<PhotoSheet>` in the visit form** — Photos
  collapsible section between Marketing and Notes. Hidden
  `<input type="file" accept="image/*" capture="environment">`,
  88×88 thumbnails with status pill, per-photo bottom sheet
  (caption max 120, on-blur save, destructive Delete, Retry on
  failed). One-shot warm-tone heads-up toast at 15.
- **Server routes (4 new):**
  - `POST /api/photos/upload` — direct upload, `handleUpload`
    authorizes via `authorizeForSubmission` against the parent row;
    `onUploadCompleted` inserts the photos row with **trusted**
    server-side `repId`/`schoolId` packed into tokenPayload.
  - `GET /api/submissions/[id]/photos` — owner-or-admin DTO list.
  - `DELETE /api/photos/[id]` — soft-delete (flips `deleted_at`).
  - `GET /api/photos/[id]/file` — private-blob proxy.
- **`src/lib/submission-auth.ts`** — `authorizeForSubmission(id)`
  extracted from `/api/submissions/[id]/route.ts` (Cycle 10) so the
  Cycle 13 photo routes reuse the 401→404→403 matrix.
- **Sync engine two-phase**: `drainPendingSubmissions()` (existing
  logic, named helper) → `drainPendingPhotos()`. Ordering guard:
  photos whose parent submission is still in the Dexie pending store
  skip this drain. Per-photo retry cap of 5 attempts → terminal
  `failed`; manual `retryPhoto(id)` resets and re-kicks.
- **`<PhotoGallery>` + `<PhotoLightbox>`** (`src/components/photos/`):
  3-col mobile / 4-col sm+ grid that merges server photos (via the
  proxy URL) with local pending Dexie rows (deduped). Lightbox uses
  Object URL on local Blobs for full quality, the proxy for synced.
  Owner/admin Delete via confirm modal.
  Wired into `/submissions/[id]` (between Marketing and Notes) and
  the `/admin` Submissions expandable detail.
- **`/api/summarize` vision input**: prompts now return
  `ContentBlockParam[]` (text + base64 image blocks). All three scopes
  (`pipeline`/`rep`/new `visit`) inject the photo grid. The system
  prompt grew a Photos paragraph (reference what you actually see;
  prefer photo over contradicting caption; never invent details).
  Cost log now includes `photos` (sent) and `photosDropped` (over-cap
  fallback aggregate); still no submission content logged.
- **`/admin` Deep analysis button** — eye icon on the expandable row,
  visible only when the row's loaded photo count > 0. Reuses the
  existing streaming summary panel via a discriminated `runSummary`
  union (`pipeline | rep | visit`).

**Changed**
- `useSyncStatus` extended (additive — no breaking changes): existing
  `pendingCount`/`syncing`/`hasFailed` stay submission-only; new
  `pendingPhotos`/`photosUploading`/`photosFailed`/`totalUnfinished`.
- `<SyncStatusStrip>` extended on `/submissions`: same calm "All
  synced" empty state; warm-toned line now reads "⏳ N pending sync ·
  M photo(s) uploading" with either side hidden when zero.
- `<TabBar>` Submissions badge now counts `totalUnfinished` so a
  photo-only queue is visible from any screen.
- `<VisitForm>` lifted `submissionId` to component state so photos can
  be enqueued before the rep saves. New-visit: minted lazily and
  persisted on the draft. Edit: fixed to `editSubmission.id`.
  `discardDraft` + `handleBack` now also delete every local photo with
  this submissionId (orphan cleanup); back-confirm body adapts when
  local photos are present.
- Middleware: `/api/photos/upload` joins `/api/auth/*` and `/api/health`
  in the public-passthrough list. The Vercel Blob completion callback
  hits the route server-to-server with no auth cookie; the SDK
  verifies signatures internally. A 302 would break both halves.

**Notes / verification**
- **Two new dependencies** (pinned exact, flagged):
  `@vercel/blob@2.4.0`, `browser-image-compression@2.0.2`.
- **One new env var** (Sensitive): `BLOB_READ_WRITE_TOKEN` — auto-
  created by the Vercel Blob dashboard integration on Prod/Preview/
  Dev. Like `DATABASE_URL` and `ANTHROPIC_API_KEY`, `vercel env pull`
  returns it blank; copy manually into `.env.local` for local dev.
- **One schema migration**: `drizzle/0002_motionless_doctor_faustus.sql`
  applied to Neon via `npx drizzle-kit migrate`. Verified live: 15
  columns + 4 indexes (pkey + the 3 named indexes).
- **Local Blob smoke** verified at Checkpoint A against the live store:
  put(access:'private'), anonymous fetch → 403, get(access:'private')
  → 200 with bytes, del() ok.
- `npm run build` clean (27 routes incl. 4 new photo routes).
  `tsc --noEmit` clean across all 8 checkpoints. Existing lint
  errors (in `submission-detail.tsx`/`use-submissions.ts`) carry
  over from prior cycles; no new errors from Cycle 13 code.
- **`onUploadCompleted` is a server-to-server callback from Vercel
  Blob.** In `npm run dev` on localhost Vercel can't reach back; the
  token-generation half works locally, but the photos row only lands
  after deployment to a Vercel preview/prod URL.
- **On-device portion of the live check** (the team's phones; spec-
  required): capture → reload → photo persists → reconnect → drain →
  thumbnail appears via the proxy. Pipeline + Deep-analysis summaries
  visibly reference photographed details. The upload + sync engine +
  status UI + admin Deep-analysis button are verified here; the
  airplane-mode photo round-trip on the installed PWA is inherently
  a device-install check that the team should do on their phones.
- Checkpoint-committed A → H. Live:
  https://valkolimark-wenger-field-notes.vercel.app

## Cycle 12 — Offline-first foundation (2026-05-19)

The submission flow is now **local-first**: reps work through dead zones
without losing data — drafts survive, finished visits queue locally,
pending visits stay editable/deletable until they sync, and the queue
drains automatically when connectivity returns. Builds on Cycle 11's
manifest/standalone work; no manifest changes.

Shipped as **one cycle, eight checkpoints** (deliberate override of the
"one slice per cycle" rule, user-approved at the proceed gate) so the
move is atomic for the team.

**Decisions:**
- **`@serwist/next` over hand-rolled SW** — Next 16 + serwist v9 compat
  verified at install (`peerDependencies.next: ">=14"`). Production
  build switched to **`next build --webpack`** because serwist v9 is
  webpack-based and Next 16's Turbopack production build conflicted.
- **`/api/health` is public** — middleware short-circuits it parallel
  to `/api/auth/*`. The sync engine uses a real `HEAD /api/health` (not
  `navigator.onLine`, which lies on iOS); a redirected probe would have
  falsely read "online."
- **No legacy localStorage draft migration** — drafts are
  device-local/ephemeral; the new Dexie store starts fresh; orphan
  `wenger.draft.*` keys decay naturally.
- **CA bbox tile cache** lat 32.5–42 × lon −124.5 to −114, zooms 8–14,
  `maxEntries: 800`, `maxAgeSeconds: 30d`, **StaleWhileRevalidate**.
- **Race policy** (pending row syncs mid-edit): save handler detects
  `{ok:false, reason:"not-pending"}` from `updatePendingContent` →
  `router.replace(.../edit?just-synced=1)` → `EditSubmission` bypasses
  Dexie + pops a one-shot notice → page loads in non-pending mode.

**Added**
- `src/lib/db/local.ts` — Dexie database `wenger-fieldnotes` v1 with
  two stores: `drafts` (composite key `${repId}__${schoolId}`,
  secondary indexes on `repId`/`schoolId`/`updatedAt`) and `pending`
  (primary `id`, secondary on `repId`/`status`/`createdAtLocal`).
  `PendingStatus = "pending"|"syncing"|"synced"|"failed"`,
  `PENDING_SCHEMA_VERSION = 1`. Typed helpers: `loadDraft`/`saveDraft`/
  `clearDraft`, `enqueuePending`, `getPending`/`getAllPending`/
  `getPendingByRep`, `updatePendingContent` (rejects "not-pending"
  rows — the race hook), `setPendingStatus`, `deletePending`.
- `src/lib/sync.ts` — client sync engine. `drainOnce()` probes
  `/api/health` → iterates pending+failed rows → flips each to
  `syncing` → POSTs `/api/submissions` → on success `deletePending`,
  on failure resets to `pending` with `lastError`/`retryCount++`. One
  drain in flight at a time. Strips Dexie-only fields before POST.
  `useSyncEngine()` mounts once (in `AppShell`): initial drain +
  `window 'online'` listener + 60s interval. `useSyncStatus()` exposes
  reactive `{pendingCount, syncing, hasFailed}` via `useLiveQuery`.
- `src/app/sw.ts` (Serwist worker): precaches `self.__SW_MANIFEST`
  (app shell, `_next/static`, …); runtime route for OSM tiles inside
  the CA bbox at z8–14 (`StaleWhileRevalidate` cache
  `osm-tiles-ca-v1`); `@serwist/next` `defaultCache` after it.
- `src/app/api/health/route.ts` — GET+HEAD return `{ok:true, ts}` with
  `cache-control: no-store`. Public.
- `src/components/sync/sync-status-strip.tsx` — `/submissions`-only
  status strip: "✓ All synced" calm gray when clean; "⏳ N pending
  sync" warm `#b8612a` + **Sync now** (spinning while syncing/manual,
  disabled while busy) otherwise.
- `src/components/sw/register-sw.tsx` — mounts the production-only SW
  registration on the root layout (idempotent; dev disabled).
- **New committed assets:** none (source icons unchanged). **New deps
  (pinned exact, flagged):** `@serwist/next@9.5.11`, `serwist@9.5.11`,
  `dexie@4.4.2`, `dexie-react-hooks@4.4.0`.

**Changed**
- Visit form: new-visit `save` is now **local-first** —
  `enqueuePending(submission)` → clear draft → toast → navigate.
  `drainOnce()` kicked from the form so an online rep sees the row
  flip to synced within seconds (not the next 60s tick). Edit branch
  takes new `isPendingEdit` prop: pending → `updatePendingContent`,
  synced → existing PATCH. Mid-sync race shows toast + redirects.
  Draft autosave debounce 400 → 500ms; drafts moved from localStorage
  to Dexie (async `loadDraft`/`saveDraft`/`clearDraft`).
- `useSubmissions` returns `ListSubmission[]` (server + reactive Dexie
  pending, deduped server-wins). Exposes `pendingCount`.
- `SubmissionsList`: per-row "Pending sync" warm badge; delete
  branches on `isPending` → `deletePending` locally (never reaches
  the server) vs Cycle 10 API DELETE.
- `SubmissionDetail`: loads Dexie pending first; "Pending sync" badge
  in header; delete branches the same way.
- `EditSubmission`: loads Dexie first (skipped when `?just-synced=1`);
  passes `isPendingEdit` to `VisitForm`; pops the race notice.
- `AppShell`: mounts `useSyncEngine()` once per shell mount.
- `TabBar`: small warm numeric badge on **My Submissions** when
  `pendingCount > 0` — visible from anywhere. Header still untouched.
- `next.config.ts`: wrapped with `withSerwistInit` (swSrc
  `src/app/sw.ts` → swDest `public/sw.js`, `cacheOnNavigation`,
  `reloadOnOnline`, dev disabled). `package.json` build:
  `next build --webpack`.
- `middleware.ts`: short-circuits `/api/health`; allowlist extended
  for `sw.js`, `swe-worker-*.js`, `workbox-*.js`.
- `lib/submissions.ts` dead-code purge: removed the four localStorage
  draft helpers + `Draft` interface (only used by the visit form,
  which now imports from `lib/db/local`).

**Notes / verification**
- **Four new dependencies** flagged above; **zero new env vars, zero
  schema migrations** (server schema unchanged — local Dexie schema
  is client-only). Build outputs `public/sw.js` + `public/swe-worker-*.js`
  gitignored (regenerated each build).
- `npm run build` clean per checkpoint (23 routes incl.
  `/api/health` + `/manifest.webmanifest` + the new edit route from
  Cycle 10). `tsc --noEmit` clean.
- Live verification: `/api/health` GET 200 + JSON; `/manifest.webmanifest`
  200; `/sw.js` 200 + serwist precache logic; all icons + meta tags
  intact from Cycle 11.
- **On-device portion of the live check** (the team's phones; spec-
  required): installed-PWA airplane-mode flow — open map with cached
  tiles + schools, fill form offline, force-quit + reopen offline,
  reconnect → queue drains automatically, cross-device sync, mid-edit
  race redirect. The SW + Dexie + sync engine + status UI are
  verified here; **the airplane-mode round-trip on the installed PWA
  is inherently a device-install check** that the team should do on
  their phones (or hand to Mark/Jackie).
- Architectural guardrails: server stays canonical (local DB =
  write-ahead cache + draft store); no conflict resolution (offline
  edits only apply to records the server hasn't seen); offline edit
  of synced records deferred indefinitely; `schema_version=1` is
  groundwork for future payload changes; session cookie carries the
  rep through offline use after one online login; auth / admin / AI
  remain online-only by design.
- Checkpoint-committed A → H. Live:
  https://valkolimark-wenger-field-notes.vercel.app

## Cycle 11 — Standalone/PWA presentation polish (2026-05-18)

The app installs to the home screen as a standalone PWA with the Wenger
navy chrome, safe-area handling, and a layout-aware header. Second slice
of the post-launch split (Cycle 10 = edit/delete).

**Decisions:**
- **App icons from a provided source:** the user supplied
  `images/W__blue circle.png` (887×938, alpha) — a square "W" circle
  mark. Generated `public/icon-192.png` / `icon-512.png` /
  `apple-touch-icon.png` via `sips` (center-crop to square → resize, no
  distortion, **zero deps**). Source kept under `images/` (not shipped).
- **Manifest** via Next `app/manifest.ts` (typed metadata route, no dep)
  over a static JSON.
- **Adaptive-header signal:** one centralized route classifier
  (`lib/layout-mode.ts`), read by the header via `usePathname()` — not
  per-page hardcoding. `/map` is the only full-bleed route today.
- **statusBarStyle `default`** (not `black-translucent`): the OS keeps
  the status bar reserved (themed by theme-color), guaranteeing the navy
  header never underlaps it on any device — "no overlap" over maximal
  immersion.

**Added**
- `src/app/manifest.ts` → `/manifest.webmanifest`: `standalone`,
  `start_url`/`scope` `/`, `theme_color`/`background_color` `#0A3758`,
  name "Wenger Field Notes" / short "Field Notes", portrait, icons
  (192 any, 512 any, 512 maskable).
- `public/icon-192.png`, `public/icon-512.png`,
  `public/apple-touch-icon.png` (generated; **new committed assets**,
  flagged).
- `src/lib/layout-mode.ts` — `isFullWidthRoute()` single source of truth
  (prefix match; `/map` today).

**Changed**
- Root `layout.tsx`: new `viewport` export — `viewportFit: "cover"` +
  `themeColor: "#0A3758"` + `width/initialScale`; `metadata.appleWebApp`
  (capable, title "Field Notes", `statusBarStyle: "default"`) +
  `metadata.icons.apple`. (Next auto-injects the `<link rel="manifest">`.)
- `AppHeader`: layout-aware — full-bleed routes drop `mx-auto max-w-3xl`
  so the logo sits flush far-left and the user menu flush far-right
  (px-4 inset kept for notch/rounded corners); boxed routes unchanged.
- `middleware.ts`: static-asset allowlist extended with
  `manifest.webmanifest` + the three icon PNGs (same pattern as the
  logos) so install/icons resolve **pre-auth** (e.g. installing from the
  login screen) instead of 302→`/`.

**Notes / verification**
- **Zero new dependencies, zero new env vars, zero schema migrations.**
  New committed assets: 3 icon PNGs (flagged above).
- **Safe-area:** the shell already used `env(safe-area-inset-*)`
  (header `pt`, tab bar `pb`, main `calc(...)`, map fixed layer, save
  bar, toast stack). The missing piece was `viewport-fit=cover` (now
  set) which *activates* those insets in standalone — no other
  safe-area code change was needed; verified by inspection.
- `npm run build` clean (22 routes incl. `○ /manifest.webmanifest`);
  `tsc --noEmit` clean per checkpoint.
- Live verification: `/manifest.webmanifest` 200 + correct JSON, the
  three icons 200 `image/png` (reachable pre-auth), and the login HTML
  carries `<link rel=manifest>`, `theme-color #0A3758`,
  `viewport ... viewport-fit=cover`, `apple-mobile-web-app-*`,
  `apple-touch-icon`.
- **On-device portion of the live check** (the team's phones): installed
  standalone on iOS (Add to Home Screen) + Android shows no
  overlap/offscreen/resize glitch; full-bleed `/map` header edge-to-edge
  vs boxed elsewhere; 375px unaffected. The adaptive-header logic + meta
  tags are verified here; the standalone visual is inherently a
  device-install check.
- Checkpoint-committed (A manifest/icons/viewport, C adaptive header;
  B safe-area = verify-only no-op). Live:
  https://valkolimark-wenger-field-notes.vercel.app

## Cycle 10 — Edit & delete submissions (2026-05-18)

Reps can now edit and delete their **own** submissions; admins can edit
and delete **any** submission. The visit form is reused, prefilled, for
editing. First slice of the post-launch 2-cycle split (Cycle 11 =
standalone/PWA + adaptive header).

**CLAUDE.md (Checkpoint 1, pre-approved):** the open-ended "Cycles 10+"
placeholder replaced with concrete **Cycle 10** (edit/delete) and
**Cycle 11** (standalone/PWA presentation polish) entries + a new
"Cycles 12+" placeholder. `docs/NEXT-SESSION.md` (the kickoff doc) is now
tracked.

**GATE decisions (approved):**
- **One route, not two:** `PATCH` + `DELETE` added to the existing
  `/api/submissions/[id]` (owner-or-admin), not a separate
  `/api/admin/submissions/[id]`. Admin UI calls the same route.
- **Edit bypasses the localStorage draft system entirely** — no restore,
  no autosave in edit mode; the new-visit draft flow is byte-unchanged.
- **Content-only editable, identity locked:** `priority` + Contact /
  Purchasing / Decision-making / Marketing / Notes editable;
  `id`/`repId`/`repName`/`schoolId`/`schoolName` immutable, so an admin
  editing another rep's row never reassigns ownership. `visitDate` is
  round-tripped (the form has no date control) and `updatedAt` is bumped.

**Added**
- `PATCH` + `DELETE` on `/api/submissions/[id]` (`runtime=nodejs`) behind
  a shared `authorizeForRow()` gate — 401 → 404 → 403, session-derived
  `repId` (never body/email); PATCH body-validated like
  `POST /api/submissions`; single atomic row `DELETE` (no `db.batch`
  needed for one statement). `GET` refactored onto the shared gate
  (behavior unchanged).
- `/submissions/[id]/edit` route: server `page.tsx` → `EditSubmission`
  client loader (mirrors `SubmissionDetail`:
  loading/notfound/forbidden/error) → reuses `<VisitForm>` prefilled +
  route `loading.tsx` (`FormSkeleton`) / `error.tsx` (`<ErrorState>`).
- Rep entry points: Edit + Delete on `/submissions/[id]` detail
  (destructive `<Button>`) and per-row on the `/submissions` list (card
  split into a nav `<Link>` + an action bar; ghost-red Delete).
- Admin entry point: Edit + Delete in the `/admin` Submissions
  expandable detail row.
- All deletes go through the existing `useToast().confirm()` modal
  (destructive) → success toast → list/detail refresh or redirect. No
  `window.confirm`.

**Changed**
- `VisitForm` takes an optional `editSubmission`: prefilled state,
  `PATCH` on save ("Save changes", no "start another"), routes back to
  the detail; draft effects guarded by `isEdit`.
- Inner-app header logo swapped to the official Wenger brand wordmark —
  new asset **`public/logo-brand-white.png`** (from
  `docs/Wenger Brand Logo_white.png`, 1457×641, white-on-transparent),
  intrinsic `width/height` set on `next/image`. Login + `/set-password`
  keep `/logo-white.png` (scoped to the inner shell only). Same
  white-logo-left brand placement — asset swap, not a rule change, so
  CLAUDE.md's brand section is untouched.

**Notes / verification**
- **Zero new dependencies, zero new env vars, zero schema migrations**
  (`updatedAt` already on the table since Cycle 5). One new committed
  asset (the brand logo) — flagged above.
- `npm run build` clean (21 routes; new `/submissions/[id]/edit` dynamic
  + updated `/api/submissions/[id]`); `tsc --noEmit` clean per checkpoint.
- Local **no-mutation** smoke (DB untouched, honoring the seed
  guardrail): unauth `PATCH`/`DELETE` `/api/submissions/[id]` and the
  edit page all 302 → `/` (middleware = defense line 1; the route's
  `authorizeForRow` 401/403 is line 2, same proven Cycle 6/7 pattern).
- The authenticated owner/admin matrix (rep edits/deletes only own; rep
  403 on others'; admin edits/deletes any without reassigning the row's
  rep; toast-confirm delete) is the **in-browser portion of the live
  check** — no DB writes were made locally, so the seed (7 users, only
  `mark.mireles` `password_set`, `BHrdlichka=1`) is unchanged and Mark's
  private password untouched. JWT type-augmentation casts untouched.
- Checkpoint-committed (1 plan/docs, 2 API, 3 form+route, 4 rep UI,
  5 admin UI, + logo). Live: https://valkolimark-wenger-field-notes.vercel.app

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
