"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Submissions" },
  { href: "/admin/users", label: "Users" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <div className="mb-5 flex gap-1 border-b border-black/8">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px min-h-[44px] border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-brand-warm text-brand-navy"
                : "border-transparent text-brand-navy/50 hover:text-brand-navy"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
