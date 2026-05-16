"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRep } from "./rep-context";
import { AppHeader } from "./app-header";
import { TabBar } from "./tab-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { rep, ready } = useRep();

  // No rep (e.g. deep-link or logout): bounce back to login.
  useEffect(() => {
    if (ready && !rep) router.replace("/");
  }, [ready, rep, router]);

  // Avoid flicker while reading localStorage / during the redirect.
  if (!ready || !rep) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-linear-to-b from-brand-navy-dark to-brand-navy-light">
        <p className="text-sm text-white/70">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="min-h-screen px-5 pb-[calc(5rem_+_env(safe-area-inset-bottom))] pt-[calc(3.5rem_+_env(safe-area-inset-top))] md:pb-12 md:pt-[calc(7.5rem_+_env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-3xl py-6">{children}</div>
      </main>
      <TabBar />
    </>
  );
}
