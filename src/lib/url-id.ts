// Cycle 17: tiny helper for dynamic-route client components that need
// the URL bar as the source of truth for their segment id.
//
// Why this exists: the Cycle 12 /form/* and Cycle 16 /submissions/*
// SW prefix-fallbacks serve ONE cached HTML/RSC for every URL matching
// the pattern. When the cached HTML for /form/<brentwood> is served at
// /form/<fairmont> offline, useParams() (and any server-passed `id`
// prop) returns the CACHED id — because that's what the server baked
// into the RSC payload's route segments before caching. The URL bar,
// however, is the URL the rep actually tapped.
//
// readUrlSegment reads window.location.pathname on the client (the
// post-hydration source of truth) and falls back to a caller-supplied
// value during SSR / pre-hydration. Hydration mismatches are accepted:
// React will replace the server-rendered subtree with the client
// computation, which means the right school's data shows after
// hydration completes (no wrong-school SUBMISSION can be created,
// because the form's save handler reads the same client-resolved id).

export function readUrlSegment(
  pattern: RegExp,
  fallback: string,
): string {
  if (typeof window === "undefined") return fallback;
  const m = pattern.exec(window.location.pathname);
  if (!m || !m[1]) return fallback;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

// Pre-compiled matchers for the routes that need this protection.
// Each captures the dynamic segment as group 1.
export const FORM_SCHOOL_ID_PATH = /^\/form\/([^/?#]+)/;
export const SUBMISSION_ID_PATH = /^\/submissions\/([^/?#]+)/;
