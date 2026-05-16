import { Suspense } from "react";
import Link from "next/link";
import PlaceholderContent from "./placeholder-content";

export default function PlaceholderPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-linear-to-b from-brand-navy-dark to-brand-navy-light px-6 py-12 text-center">
      <Suspense
        fallback={<p className="text-sm text-white/70">Loading…</p>}
      >
        <PlaceholderContent />
      </Suspense>

      <Link
        href="/"
        className="mt-8 text-sm text-white/70 underline-offset-4 transition-colors duration-200 hover:text-white hover:underline"
      >
        ← Back to login
      </Link>
    </main>
  );
}
