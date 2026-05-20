"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, ClipboardList, type LucideIcon } from "lucide-react";
import { useSyncStatus } from "@/lib/sync";

type Tab = { href: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { href: "/map", label: "Map", icon: Map },
  { href: "/submissions", label: "My Submissions", icon: ClipboardList },
];

export function TabBar() {
  const pathname = usePathname();
  // Cycle 12: reactive pending count from Dexie — visible from anywhere.
  // Cycle 13: badge now counts photos too via `totalUnfinished`, so a
  // photo-only queue is also visible.
  const { totalUnfinished } = useSyncStatus();
  const badgeCount = totalUnfinished;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:bottom-auto md:top-[calc(3.5rem_+_env(safe-area-inset-top))] md:border-b md:border-t-0 md:pb-0"
    >
      <ul className="mx-auto flex w-full max-w-3xl">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors duration-200 ${
                  active
                    ? "text-brand-navy"
                    : "text-brand-navy/45 hover:text-brand-navy/70"
                }`}
              >
                <span className="relative">
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.4 : 2}
                    aria-hidden
                  />
                  {href === "/submissions" && badgeCount > 0 && (
                    <span
                      aria-label={`${badgeCount} pending sync`}
                      className="absolute -right-2 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-warm px-1 text-[10px] font-semibold leading-none text-white"
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </span>
                <span>{label}</span>
                {active && (
                  <span className="absolute inset-x-7 top-0 h-0.5 rounded-full bg-brand-warm md:bottom-0 md:top-auto" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
