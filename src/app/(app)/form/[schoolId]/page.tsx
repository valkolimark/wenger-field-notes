import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { schools } from "@/lib/schools";

export default async function VisitFormStubPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const school = schools.find((s) => s.id === schoolId);

  return (
    <section>
      <Link
        href="/map"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy/60 transition-colors hover:text-brand-navy"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to map
      </Link>

      <h1 className="mt-5 font-display text-3xl text-brand-navy">
        {school ? school.name : "Visit form"}
      </h1>

      {school && (
        <p className="mt-1 text-sm text-brand-navy/55">
          {school.address}, {school.city}
        </p>
      )}

      <p className="mt-6 rounded-xl border border-black/5 bg-brand-navy/5 p-4 text-sm leading-relaxed text-brand-navy/70">
        The visit form is coming in Cycle 4. This route exists now so the
        URL structure is in place.
      </p>
    </section>
  );
}
