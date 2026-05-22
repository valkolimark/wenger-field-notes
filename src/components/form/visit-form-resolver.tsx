"use client";

// Cycle 12 fix: resolve the school from the static list CLIENT-SIDE so
// /form/[schoolId] renders the same HTML for every school. The SW can
// then cache one /form/* response and serve it for any other school's
// URL offline.
//
// Cycle 17 (initial): useParams() can't be the resolver — it reads
// from the App Router's route tree, whose segment params come from
// the (possibly cached) RSC payload. When the SW serves
// /form/<brentwood> for a /form/<fairmont> URL offline, useParams
// returns "brentwood" and the rep sees + submits the wrong school.
// Switched to window.location.pathname.
//
// Cycle 17 (followup): reading window.location DURING render means
// the SERVER render gets the fallback (empty string), which baked
// "School not found" into the cached HTML — and reps saw that flash
// before client hydration could correct it. The SW-served cached
// HTML must be school-AGNOSTIC. Now we render <FormSkeleton/> on
// the server / pre-mount, and resolve the school from the URL bar
// inside useEffect after mount. The hydrated cached HTML always
// starts as the skeleton, then transitions to the correct school
// for whichever URL the rep tapped. No wrong-school flash, no
// "School not found" flash.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { schools } from "@/lib/schools";
import { VisitForm } from "@/components/form/visit-form";
import { FormSkeleton } from "@/components/ui/skeleton";
import { FORM_SCHOOL_ID_PATH } from "@/lib/url-id";

export function VisitFormResolver() {
  // null = "not yet resolved" (server / pre-mount). After mount,
  // becomes the URL bar's schoolId (possibly "" if URL doesn't match,
  // which would render "School not found" — a real, non-cached state).
  const [schoolId, setSchoolId] = useState<string | null>(null);

  useEffect(() => {
    function read() {
      const m = FORM_SCHOOL_ID_PATH.exec(window.location.pathname);
      let id = "";
      if (m?.[1]) {
        try {
          id = decodeURIComponent(m[1]);
        } catch {
          id = m[1];
        }
      }
      setSchoolId(id);
    }
    read();
    // popstate covers back/forward; pushstate (Next router) re-mounts
    // the page on dynamic-segment change, so we don't need a more
    // elaborate URL subscription here.
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  if (schoolId === null) {
    return <FormSkeleton />;
  }

  const school = schools.find((s) => s.id === schoolId);

  if (!school) {
    return (
      <section>
        <h1 className="text-3xl text-brand-navy">School not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-navy/60">
          We couldn&apos;t find that school. It may have been removed or
          the link is wrong.
        </p>
        <Link
          href="/map"
          className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-light"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to map
        </Link>
      </section>
    );
  }

  return <VisitForm school={school} />;
}
