"use client";

import { AppHeader } from "./app-header";
import { TabBar } from "./tab-bar";

// Cycle 6: route protection moved to middleware.ts (NextAuth). The shell
// no longer gates on a localStorage rep — it just renders the chrome.
export function AppShell({ children }: { children: React.ReactNode }) {
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
