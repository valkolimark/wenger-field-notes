import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { schools } from "@/lib/schools";
import { VisitForm } from "@/components/form/visit-form";

export default async function VisitFormPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const school = schools.find((s) => s.id === schoolId);

  if (!school) {
    return (
      <section>
        <h1 className="text-3xl text-brand-navy">
          School not found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-navy/60">
          We couldn&apos;t find that school. It may have been removed or the
          link is wrong.
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
