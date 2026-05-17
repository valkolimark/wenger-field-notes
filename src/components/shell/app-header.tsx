"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

export function AppHeader() {
  const { data: session } = useSession();
  const name = session?.user?.name || session?.user?.email || "";
  const initial = name ? name.charAt(0).toUpperCase() : "?";

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
          <Link
            href="/account"
            aria-label="Account settings"
            className="flex min-h-[44px] items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-1 transition-colors duration-200 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:pr-3"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-xs font-semibold text-white">
              {initial}
            </span>
            <span className="hidden text-sm font-medium text-white sm:inline">
              {name}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            aria-label="Log out"
            className="grid h-11 w-11 place-items-center rounded-full text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <LogOut size={18} aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
