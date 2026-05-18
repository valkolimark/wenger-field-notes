"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Shield, User, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { isFullWidthRoute } from "@/lib/layout-mode";

export function AppHeader() {
  const { data: session } = useSession();
  // Layout-aware: full-bleed routes (e.g. /map) push the logo to the far
  // left and the user menu to the far right; boxed routes keep the
  // content-width (max-w-3xl) alignment unchanged.
  const fullWidth = isFullWidthRoute(usePathname());
  const name = session?.user?.name || session?.user?.email || "";
  const role = session?.user?.role;
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  const isAdmin = role === "admin";

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemCls =
    "flex min-h-[44px] w-full items-center gap-2.5 px-4 text-sm text-brand-navy transition-colors hover:bg-brand-navy/5";

  return (
    <header className="fixed inset-x-0 top-0 z-30 bg-brand-navy pt-[env(safe-area-inset-top)]">
      <div
        className={`flex h-14 w-full items-center justify-between px-4 ${
          fullWidth ? "" : "mx-auto max-w-3xl"
        }`}
      >
        <Image
          src="/logo-brand-white.png"
          alt="Wenger Corporation"
          width={1457}
          height={641}
          priority
          className="h-7 w-auto"
        />

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex min-h-[44px] items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-2 transition-colors duration-200 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:pr-3"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-xs font-semibold text-white">
              {initial}
            </span>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-white sm:inline">
              {name}
            </span>
            <ChevronDown
              size={15}
              aria-hidden
              className={`text-white/70 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 animate-pop overflow-hidden rounded-2xl border border-black/8 bg-white py-1 shadow-2xl"
            >
              <div className="border-b border-black/8 px-4 py-2.5">
                <p className="truncate text-sm font-semibold text-brand-navy">
                  {name}
                </p>
                <p className="text-xs capitalize text-brand-navy/55">
                  {role ?? ""}
                </p>
              </div>
              <Link
                href="/account"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemCls}
              >
                <User size={16} aria-hidden />
                Account
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={itemCls}
                >
                  <Shield size={16} aria-hidden />
                  Admin dashboard
                </Link>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className={`${itemCls} text-danger`}
              >
                <LogOut size={16} aria-hidden />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
