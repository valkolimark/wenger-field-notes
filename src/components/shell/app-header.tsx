"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useRep } from "./rep-context";

export function AppHeader() {
  const router = useRouter();
  const { rep, logout } = useRep();
  const initial = rep?.charAt(0).toUpperCase() ?? "?";

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <header className="fixed inset-x-0 top-0 z-30 bg-brand-navy pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <Image
          src="/logo-white.png"
          alt="Wenger Corporation"
          width={800}
          height={450}
          priority
          className="h-7 w-auto"
        />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-1 sm:pr-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-xs font-semibold text-white">
              {initial}
            </span>
            <span className="hidden text-sm font-medium text-white sm:inline">
              {rep}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Switch rep (log out)"
            className="grid h-11 w-11 place-items-center rounded-full text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <LogOut size={18} aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
