"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

// Cycle 1: hardcoded. Real auth + allowlist arrives in Cycle 6.
const REPS = ["Brooke", "Jackie", "Rahki", "Chad", "Tam", "Linda"] as const;

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-linear-to-b from-brand-navy-dark to-brand-navy-light px-6 py-12">
      <div className="flex w-full max-w-sm animate-fade-in flex-col items-center">
        <Image
          src="/logo-white.png"
          alt="Wenger Corporation"
          width={800}
          height={450}
          priority
          className="h-20 w-auto"
        />

        <h1 className="mt-5 font-display text-lg italic text-white">
          Field Notes
        </h1>

        <p className="mt-2 text-sm text-white/70">Pick your name to begin</p>

        <div className="mt-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
          {REPS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() =>
                router.push(`/placeholder?rep=${encodeURIComponent(name)}`)
              }
              className="min-h-[56px] rounded-xl border border-white/20 bg-white/10 px-4 py-4 text-base font-medium text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:translate-y-0"
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
