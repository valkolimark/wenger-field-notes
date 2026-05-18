// Cycle 11: single source of truth for which routes render full-bleed
// (chrome goes edge-to-edge) vs boxed (aligned to the max-w-3xl content
// width). The header reads this via usePathname() — route classification,
// not per-page hardcoding. `/map` is the only fixed full-bleed screen
// today; prefix match keeps future full-width subroutes one-liners.
const FULL_WIDTH_PREFIXES = ["/map"] as const;

export function isFullWidthRoute(pathname: string): boolean {
  return FULL_WIDTH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
