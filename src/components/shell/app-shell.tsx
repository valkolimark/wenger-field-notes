"use client";

import { AppHeader } from "./app-header";
import { TabBar } from "./tab-bar";
import { useSyncEngine } from "@/lib/sync";
import { PrefetchOfflineRoutes } from "@/components/sw/prefetch-routes";

// Cycle 6: route protection moved to middleware.ts (NextAuth). The shell
// no longer gates on a localStorage rep — it just renders the chrome.
// Cycle 12: mounts the offline sync engine (online listener + 60s
// interval + initial drain) and the post-auth SW prefetch one-shot.
export function AppShell({ children }: { children: React.ReactNode }) {
  useSyncEngine();
  return (
    <>
      <PrefetchOfflineRoutes />
      <AppHeader />
      <main className="min-h-screen px-5 pb-[calc(5rem_+_env(safe-area-inset-bottom))] pt-[calc(3.5rem_+_env(safe-area-inset-top))] md:pb-12 md:pt-[calc(7.5rem_+_env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-3xl py-6">{children}</div>
      </main>
      <TabBar />
    </>
  );
}
