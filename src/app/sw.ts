/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Cycle 12: Serwist-managed service worker. Build-time serwist replaces
// self.__SW_MANIFEST with the precache list (app shell + _next/static +
// static assets). Runtime caching:
//   - OSM tiles within the CA bbox at zooms 8–14 (SWR, 30-day expiry)
//   - @serwist/next defaultCache for Next assets, fonts, nav docs.

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

// California bounding box (rough rectangle covering the state — close
// enough; tiles outside fall through to network).
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
        // Required by serwist's ExpirationPlugin when used with a
        // non-Cache-API-managed origin (cross-origin OSM tiles).
        purgeOnQuotaError: true,
      }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // CA tile route first so it wins before defaultCache's generic
  // image/cross-origin handlers.
  runtimeCaching: [osmTilesRoute, ...defaultCache],
});

serwist.addEventListeners();
