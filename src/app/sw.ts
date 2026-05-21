/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Cycle 12: Serwist-managed service worker. Build-time serwist replaces
// self.__SW_MANIFEST with the precache list (app shell + _next/static +
// static assets).
//
// Runtime caching, ordered (first match wins):
//   1. OSM tiles within the CA bbox at zooms 8–14 (SWR, 30-day expiry)
//   2. /api/auth/* — try network, never reject (synthetic 503 offline)
//      so NextAuth client polling can't crash the page with
//      `FetchEvent.respondWith received an error: no-response`.
//   3. RSC payload fetches (RSC: 1 header) — NetworkFirst with cache
//      fallback. Without this, tapping between tabs offline fails
//      (App Router fetches the server-component payload on nav).
//   4. Same-origin navigations — NetworkFirst with cache fallback; on
//      cache miss falls back to "/" (or a synthetic offline HTML).
//   5. @serwist/next defaultCache for everything else (Next assets,
//      fonts, etc.).

import { defaultCache } from "@serwist/next/worker";
import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from "serwist";
import {
  ExpirationPlugin,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
// Cycle 15: SW bundles the static schools dataset so the install
// handler can prefetch `/form/${schools[0].id}` directly — closing
// the Cycle 14 regression where the form URL was only cached by the
// async post-auth client→SW prefetch (and missing it left the nav
// fallback chain serving cached /map for any /form/<id> tap).
import { schools } from "@/lib/schools";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

// ------------------------------------------------------------------ OSM
// California bounding box (rough rectangle; tiles outside fall through
// to network and are not cached).
const CA = {
  lonMin: -124.5,
  lonMax: -114.0,
  latMin: 32.5,
  latMax: 42.0,
} as const;

const OSM_TILE_HOSTS = new Set([
  "a.tile.openstreetmap.org",
  "b.tile.openstreetmap.org",
  "c.tile.openstreetmap.org",
  "tile.openstreetmap.org",
]);

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      2 ** z,
  );
}
function isCATile(url: URL): boolean {
  if (!OSM_TILE_HOSTS.has(url.host)) return false;
  const m = /^\/(\d{1,2})\/(\d+)\/(\d+)\.png$/.exec(url.pathname);
  if (!m) return false;
  const z = Number(m[1]);
  const x = Number(m[2]);
  const y = Number(m[3]);
  if (z < 8 || z > 14) return false;
  const xMin = lonToTileX(CA.lonMin, z);
  const xMax = lonToTileX(CA.lonMax, z);
  // lat→y is inverted (higher latitude = lower y).
  const yMin = latToTileY(CA.latMax, z);
  const yMax = latToTileY(CA.latMin, z);
  return x >= xMin && x <= xMax && y >= yMin && y <= yMax;
}

const osmTilesRoute: RuntimeCaching = {
  matcher: ({ url }) => isCATile(url),
  handler: new StaleWhileRevalidate({
    cacheName: "osm-tiles-ca-v1",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 800,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
};

// ----------------------------------------------------------------- auth
// NextAuth client fetches /api/auth/session on every page mount to
// drive useSession(). Offline that fetch fails, useSession() returns
// no session, and any client code that reads session.user.repId
// (e.g. the visit form's save handler) sees an empty string and
// silently no-ops.
//
// Fix: cache successful /api/auth/session responses online and serve
// them from cache offline. Other /api/auth/* requests still get a
// synthetic 503 on failure so respondWith never rejects (no more
// "FetchEvent.respondWith received an error: no-response" Safari page).
const AUTH_CACHE = "auth-session-v1";
const authRoute: RuntimeCaching = {
  matcher: ({ url }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith("/api/auth"),
  handler: async ({ request }) => {
    const isSession =
      new URL(request.url).pathname === "/api/auth/session";
    try {
      const res = await fetch(request);
      if (isSession && res.ok) {
        const cache = await self.caches.open(AUTH_CACHE);
        void cache.put(request, res.clone());
      }
      return res;
    } catch {
      if (isSession) {
        const cached = await self.caches.match(request, {
          ignoreVary: true,
        });
        if (cached) return cached;
      }
      return new Response(JSON.stringify({ error: "offline" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
  },
};

// ------------------------------------------------- pattern-fallback helper
// Several dynamic routes render identical server HTML across all ids
// (the page chunk reads useParams() client-side and loads the right
// row), so a single cached entry can satisfy every URL matching the
// same pattern offline. Cycle 12 introduced this for /form/[schoolId];
// Cycle 16 extends it to /submissions/[id] (detail) and
// /submissions/[id]/edit (edit) so reps can view + edit pending visits
// offline without bouncing to /map.
//
// The matcher accepts a pathname and returns true if it qualifies for
// this pattern. We require both the REQUESTED URL and the cached KEY
// to satisfy the matcher — otherwise a /form/* request might pick up
// a cached /submissions/<id> entry and serve the wrong page.
type PathMatcher = (path: string) => boolean;

async function fallbackByMatcher(
  cacheName: string,
  url: URL,
  matcher: PathMatcher,
): Promise<Response | undefined> {
  if (!matcher(url.pathname)) return undefined;
  const cache = await self.caches.open(cacheName);
  for (const key of await cache.keys()) {
    if (matcher(new URL(key.url).pathname)) {
      const hit = await cache.match(key);
      if (hit) return hit;
    }
  }
  return undefined;
}

const IS_FORM_PATH: PathMatcher = (p) => p.startsWith("/form/");
// /submissions/<id> — must have something after /submissions/, and must
// NOT end in /edit (those go to the edit matcher).
const IS_SUBMISSION_DETAIL_PATH: PathMatcher = (p) =>
  /^\/submissions\/[^/]+$/.test(p);
// /submissions/<id>/edit
const IS_SUBMISSION_EDIT_PATH: PathMatcher = (p) =>
  /^\/submissions\/[^/]+\/edit$/.test(p);

// In-order fallback chain: each request runs through these in turn,
// the first one that matches AND finds a cached entry wins.
const FALLBACK_MATCHERS: PathMatcher[] = [
  IS_SUBMISSION_EDIT_PATH, // more specific than detail; check first
  IS_SUBMISSION_DETAIL_PATH,
  IS_FORM_PATH,
];

async function fallbackByAnyMatcher(
  cacheName: string,
  url: URL,
): Promise<Response | undefined> {
  for (const matcher of FALLBACK_MATCHERS) {
    const hit = await fallbackByMatcher(cacheName, url, matcher);
    if (hit) return hit;
  }
  return undefined;
}

// ------------------------------------------------------------------ RSC
// Next App Router fetches server-component payloads via GET with an
// RSC: 1 header when the user taps between tabs. Cache on success;
// offline fall back to exact-match → /form/* prefix → synthetic 504
// so the router can surface a normal error instead of the SW crashing
// the navigation.
// Cycle 14 v2→v3; Cycle 15 v3→v4; Cycle 16 v4→v5 so existing devices
// re-run install with the new prefetch list (adds /submissions/__prefetch__
// and /submissions/__prefetch__/edit) AND the redirect-skip behavior
// that prevents login-page HTML from poisoning authed-route cache keys.
const RSC_CACHE = "next-rsc-v5";
const rscRoute: RuntimeCaching = {
  matcher: ({ request, url }) =>
    url.origin === self.location.origin &&
    request.method === "GET" &&
    request.headers.get("RSC") === "1",
  handler: async ({ request }) => {
    const cache = await self.caches.open(RSC_CACHE);
    try {
      const res = await fetch(request);
      if (res.ok) void cache.put(request, res.clone());
      return res;
    } catch {
      // Search ONLY the RSC cache — a global caches.match would happily
      // return an HTML entry from PAGES_CACHE and feed it to Next's
      // router as an "RSC" payload, which then breaks the next nav.
      const cached = await cache.match(request, {
        ignoreVary: true,
        ignoreSearch: true,
      });
      if (cached) return cached;
      const url = new URL(request.url);
      const aliased = await fallbackByAnyMatcher(RSC_CACHE, url);
      if (aliased) return aliased;
      return new Response("", { status: 504 });
    }
  },
};

// ----------------------------------------------------------- navigations
// Document HTML for top-level navigations. Online → cache + return.
// Offline → exact-match → /form/* prefix → cached "/" → navy offline
// stub. Never throw (the iOS PWA "FetchEvent.respondWith received an
// error" we hit on the first round was this path rejecting).
// Cycle 14 v2→v3; Cycle 15 v3→v4; Cycle 16 v4→v5 (paired with RSC bump
// above so existing devices re-run install and abandon any login-page-
// poisoned entries from before the redirect-skip fix).
const PAGES_CACHE = "pages-v5";
const navRoute: RuntimeCaching = {
  matcher: ({ request, url }) =>
    request.mode === "navigate" &&
    url.origin === self.location.origin,
  handler: async ({ request }) => {
    const pages = await self.caches.open(PAGES_CACHE);
    try {
      const res = await fetch(request);
      if (res.ok) void pages.put(request, res.clone());
      return res;
    } catch {
      // Search ONLY the PAGES cache. A global caches.match would happily
      // return an RSC (text/x-component) entry from RSC_CACHE for the
      // same URL — Safari renders that as plain text on screen.
      const cached = await pages.match(request, {
        ignoreVary: true,
        ignoreSearch: true,
      });
      if (cached) return cached;
      const url = new URL(request.url);
      const aliased = await fallbackByAnyMatcher(PAGES_CACHE, url);
      if (aliased) return aliased;
      const root =
        (await pages.match("/map", {
          ignoreVary: true,
          ignoreSearch: true,
        })) ??
        (await pages.match("/", {
          ignoreVary: true,
          ignoreSearch: true,
        }));
      if (root) return root;
      return new Response(
        '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
          '<body style="font:16px ui-sans-serif,system-ui;padding:2rem;' +
          'background:#0A3758;color:#fff">' +
          "You're offline and this page hasn't been cached yet. " +
          "Reconnect, open the page once, then it'll work offline." +
          "</body>",
        { status: 503, headers: { "content-type": "text/html" } },
      );
    }
  },
};

// ------------------------------------------------------- install prefetch
// The classic iOS PWA gotcha: the very first navigation to start_url
// happens BEFORE the freshly-installed SW becomes the controller, so
// nothing gets cached organically — and when the user later force-quits
// and reopens offline, the SW (now controlling) intercepts the same URL
// and finds nothing in cache. Solution: prefetch the canonical routes
// at SW install so they're populated regardless of who controlled the
// first nav. SW fetches inherit the client's cookies, so an already-
// authed user gets authed HTML cached here.
// Cycle 15: `/form/${schools[0].id}` joins the install-time prefetch
// (one cached form URL satisfies the /form/* prefix fallback for every
// other school).
// Cycle 16: same trick for /submissions/[id] and /submissions/[id]/edit
// using `__prefetch__` as a placeholder id. The route renders identical
// server HTML regardless of id (the client component reads useParams()
// and loads the row from the API or Dexie), so these template entries
// satisfy the navRoute fallback for every real submission id offline.
// This is what makes "Edit a pending visit offline" work — without it,
// /submissions/<realId>/edit fell through to cached /map (the
// "couldn't edit my entry offline" complaint).
const SAMPLE_FORM_PATH = schools[0]
  ? `/form/${schools[0].id}`
  : "/form/sample";
const SAMPLE_SUBMISSION_DETAIL_PATH = "/submissions/__prefetch__";
const SAMPLE_SUBMISSION_EDIT_PATH = "/submissions/__prefetch__/edit";
const PREFETCH_NAV = [
  "/map",
  "/submissions",
  "/",
  "/account",
  SAMPLE_FORM_PATH,
  SAMPLE_SUBMISSION_DETAIL_PATH,
  SAMPLE_SUBMISSION_EDIT_PATH,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const pages = await self.caches.open(PAGES_CACHE);
        const rsc = await self.caches.open(RSC_CACHE);
        await Promise.all(
          PREFETCH_NAV.map(async (path) => {
            try {
              const res = await fetch(path, { credentials: "include" });
              // Cycle 16: do NOT cache redirected responses. If the
              // install handler fires before the user logs in (or
              // before the auth cookie reaches the SW), middleware
              // redirects authed-only routes to "/" and the response
              // arrives as the LOGIN page HTML under the original
              // URL — poisoning the cache for /form/<id>,
              // /submissions/<id>, etc. PrefetchOfflineRoutes
              // re-fetches after auth with credentials, so the
              // correct authed HTML lands then.
              if (res.ok && !res.redirected) {
                await pages.put(path, res.clone());
              }
            } catch {
              /* ignore: best-effort */
            }
            try {
              const rscRes = await fetch(path, {
                credentials: "include",
                headers: { RSC: "1" },
              });
              if (rscRes.ok && !rscRes.redirected) {
                await rsc.put(path, rscRes.clone());
              }
            } catch {
              /* ignore: best-effort */
            }
          }),
        );
      } catch {
        /* ignore: best-effort */
      }
    })(),
  );
});

// --------------------------------------------------- client → SW prefetch
// Once the client confirms the user is authenticated, it posts a list
// of URLs (including a real /form/<sampleSchoolId>) to the SW. This
// re-runs the prefetch with the auth cookie present, so the cached
// responses are authed HTML / RSC payloads — not the login redirect
// the install-time prefetch may have captured before login. The cached
// /form/<sample> entry is what the offline /form/* prefix fallback
// serves for any other school's URL (the resolver picks the right
// school client-side from useParams).
self.addEventListener("message", (event) => {
  const data = event.data as { type?: string; urls?: string[] } | null;
  if (
    !data ||
    data.type !== "PREFETCH" ||
    !Array.isArray(data.urls)
  ) {
    return;
  }
  const urls: string[] = data.urls;
  event.waitUntil(
    (async () => {
      try {
        const pages = await self.caches.open(PAGES_CACHE);
        const rsc = await self.caches.open(RSC_CACHE);
        for (const url of urls) {
          try {
            const r = await fetch(url, { credentials: "include" });
            // Same redirect-skip as the install handler (Cycle 16);
            // a redirect on this code path means auth lapsed between
            // the message and the fetch, and the cache would be
            // poisoned with login HTML.
            if (r.ok && !r.redirected) await pages.put(url, r.clone());
          } catch {
            /* best-effort */
          }
          try {
            const r = await fetch(url, {
              credentials: "include",
              headers: { RSC: "1" },
            });
            if (r.ok && !r.redirected) await rsc.put(url, r.clone());
          } catch {
            /* best-effort */
          }
        }
      } catch {
        /* best-effort */
      }
    })(),
  );
});

// ----------------------------------------------------------------- init
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Order matters: more-specific matchers first; defaultCache last
  // as the generic backstop.
  runtimeCaching: [
    osmTilesRoute,
    authRoute,
    rscRoute,
    navRoute,
    ...defaultCache,
  ],
});

serwist.addEventListeners();
