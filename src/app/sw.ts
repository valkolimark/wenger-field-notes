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

// ----------------------------------------------- /form/* prefix fallback
// /form/[schoolId] renders identical HTML for every school (the school
// is resolved client-side from useParams + the static list), so any
// cached /form/* response can satisfy any other school's URL offline.
// Used by both the RSC and navigation handlers below.
async function fallbackByPrefix(
  cacheName: string,
  url: URL,
  prefix: string,
): Promise<Response | undefined> {
  if (!url.pathname.startsWith(prefix)) return undefined;
  const cache = await self.caches.open(cacheName);
  for (const key of await cache.keys()) {
    if (new URL(key.url).pathname.startsWith(prefix)) {
      const hit = await cache.match(key);
      if (hit) return hit;
    }
  }
  return undefined;
}

// ------------------------------------------------------------------ RSC
// Next App Router fetches server-component payloads via GET with an
// RSC: 1 header when the user taps between tabs. Cache on success;
// offline fall back to exact-match → /form/* prefix → synthetic 504
// so the router can surface a normal error instead of the SW crashing
// the navigation.
const RSC_CACHE = "next-rsc-v2";
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
      const aliased = await fallbackByPrefix(RSC_CACHE, url, "/form/");
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
const PAGES_CACHE = "pages-v2";
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
      const aliased = await fallbackByPrefix(PAGES_CACHE, url, "/form/");
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
const PREFETCH_NAV = ["/map", "/submissions", "/", "/account"];

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
              if (res.ok || res.redirected) {
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
              if (rscRes.ok) {
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
            if (r.ok || r.redirected) await pages.put(url, r.clone());
          } catch {
            /* best-effort */
          }
          try {
            const r = await fetch(url, {
              credentials: "include",
              headers: { RSC: "1" },
            });
            if (r.ok) await rsc.put(url, r.clone());
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
