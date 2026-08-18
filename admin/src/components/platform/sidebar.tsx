"use client";

import { Briefcase, Building2, CreditCard, LayoutDashboard, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  { href: "/platform", label: "Overview", icon: <LayoutDashboard className="size-4" /> },
  { href: "/platform/companies", label: "Companies", icon: <Building2 className="size-4" /> },
  { href: "/platform/users", label: "Users", icon: <Users className="size-4" /> },
  { href: "/platform/jobs", label: "Jobs", icon: <Briefcase className="size-4" /> },
  { href: "/platform/billing", label: "Billing", icon: <CreditCard className="size-4" /> },
];

export function PlatformSidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-200"
    >
      <div className="flex h-14 items-center gap-2 border-b border-zinc-800 px-4">
        <Link href="/platform" className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <span aria-hidden className="size-2.5 rounded-sm bg-accent-500" />
          Rolewire Platform
        </Link>
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                  active ? "bg-zinc-800 font-medium text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                )}
              >
                <span className={active ? "text-accent-400" : "text-zinc-500"}>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-zinc-800 px-4 py-3">
        <p className="truncate text-xs font-medium text-zinc-300" title={adminEmail}>
          {adminEmail}
        </p>
        <div className="mt-2">
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}

function LogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/platform-auth/logout", { method: "POST" });
        window.location.assign("/platform/login");
      }}
      className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100"
    >
      <LogOut className="size-3.5" />
      Log out
    </button>
  );
}
