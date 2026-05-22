"use client";

// Cycle 12 fix: resolve the school from the static list CLIENT-SIDE so
// /form/[schoolId] renders the same HTML for every school. The SW can
// then cache one /form/* response and serve it for any other school's
// URL offline.
//
// Cycle 17 correction: useParams() can't be the resolver — it reads
// from the App Router's route tree, whose segment params come from
// the (possibly cached) RSC payload. When the SW serves
// /form/<brentwood> for a /form/<fairmont> URL offline, useParams
// returns "brentwood" and the rep sees + submits the wrong school.
// readUrlSegment reads window.location.pathname directly, which is
// the URL the rep actually tapped regardless of which HTML the SW
// served. The schools static list is the same on every URL, so the
// lookup still works.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { schools } from "@/lib/schools";
import { VisitForm } from "@/components/form/visit-form";
import {
  readUrlSegment,
  FORM_SCHOOL_ID_PATH,
} from "@/lib/url-id";

export function VisitFormResolver() {
  const schoolId = readUrlSegment(FORM_SCHOOL_ID_PATH, "");
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
