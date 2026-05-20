"use client";

// Cycle 12 fix: resolve the school from the static list CLIENT-SIDE so
// /form/[schoolId] renders the same HTML for every school. The SW can
// then cache one /form/* response and serve it for any other school's
// URL offline — useParams() picks up the actual current schoolId at
// render time, so the school shown is always the one in the URL bar.

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { schools } from "@/lib/schools";
import { VisitForm } from "@/components/form/visit-form";

export function VisitFormResolver() {
  const params = useParams<{ schoolId: string }>();
  const schoolId = params?.schoolId ?? "";
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
