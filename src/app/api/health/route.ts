import { NextResponse } from "next/server";

// Cycle 12: lightweight public health endpoint used by the client-side
// sync engine as a real connectivity probe (navigator.onLine lies on
// iOS). MUST be reachable without a session — middleware short-circuits
// /api/health at the top, parallel to /api/auth/*. Returns the server
// timestamp so a client can also detect a stale/cached SW response.
export const runtime = "nodejs";

const body = (ts: number) => ({ ok: true, ts });

export function GET() {
  return NextResponse.json(body(Date.now()), {
    headers: { "cache-control": "no-store" },
  });
}

export function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "x-health": String(Date.now()),
    },
  });
}
