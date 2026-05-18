import { auth } from "@/lib/auth";

// Protect everything except `/` (login), `/api/auth/*`, and static assets
// (excluded via matcher). Unauthenticated → `/`. Authenticated with
// mustChangePassword → `/set-password`.
export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isAuthed = !!req.auth;
  const mustChange = req.auth?.user?.mustChangePassword === true;

  // NextAuth endpoints (incl. /api/auth/signout) always pass through.
  if (path.startsWith("/api/auth")) return;

  if (path === "/") {
    if (!isAuthed) return; // show the login page
    return Response.redirect(
      new URL(mustChange ? "/set-password" : "/map", nextUrl),
    );
  }

  if (!isAuthed) {
    return Response.redirect(new URL("/", nextUrl));
  }

  if (mustChange && path !== "/set-password") {
    return Response.redirect(new URL("/set-password", nextUrl));
  }

  if (!mustChange && path === "/set-password") {
    return Response.redirect(new URL("/map", nextUrl));
  }

  // Cycle 7: admin-only areas. Defense in depth — every /api/admin route
  // also re-checks role server-side; this is the first line.
  const isAdminArea =
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/api/admin") ||
    path.startsWith("/api/summarize");
  if (isAdminArea && req.auth?.user?.role !== "admin") {
    if (path.startsWith("/api/")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return Response.redirect(new URL("/map", nextUrl));
  }

  return;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo-white\\.png|logo-blue\\.png|.*\\.svg).*)",
  ],
};
