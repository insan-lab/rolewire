"use client";

import {
  Briefcase,
  CreditCard,
  Inbox,
  LayoutDashboard,
  Plug,
  Settings,
  Users,
  HardDrive,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: ReactNode };

const MAIN: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { href: "/jobs", label: "Jobs", icon: <Briefcase className="size-4" /> },
  { href: "/applications", label: "Applications", icon: <Inbox className="size-4" /> },
  { href: "/billing", label: "Billing", icon: <CreditCard className="size-4" /> },
];

const SETTINGS: NavItem[] = [
  { href: "/settings/storage", label: "Storage", icon: <HardDrive className="size-4" /> },
  { href: "/settings/integrations", label: "Integrations", icon: <Plug className="size-4" /> },
  { href: "/settings/team", label: "Team", icon: <Users className="size-4" /> },
  { href: "/settings/account", label: "Account", icon: <Settings className="size-4" /> },
];

export function Sidebar({ userEmail, role }: { userEmail: string; role: string }) {
  return (
    <nav
      aria-label="Sections"
      className="hidden w-56 shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex"
    >
      <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-4">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
          <span aria-hidden className="size-2.5 rounded-sm bg-accent-600" />
          Rolewire
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <NavGroup items={MAIN} />
        <p className="mt-5 px-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-zinc-400">
          Settings
        </p>
        <NavGroup items={SETTINGS} />
      </div>

      <div className="border-t border-zinc-200 px-4 py-3">
        {/* The admin API exposes no endpoint returning the tenant's name or slug, so the workspace
            is identified by the signed-in user. A small GET /v1/admin/tenant would fix that. */}
        <p className="truncate text-xs font-medium text-zinc-700" title={userEmail}>
          {userEmail}
        </p>
        <p className="text-2xs capitalize text-zinc-400">{role}</p>
      </div>
    </nav>
  );
}

function NavGroup({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                active
                  ? "bg-accent-50 font-medium text-accent-800"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <span className={active ? "text-accent-600" : "text-zinc-400"}>{item.icon}</span>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Compact horizontal nav shown instead of the sidebar on narrow screens. */
export function MobileNav() {
  const pathname = usePathname();
  const items = [...MAIN, ...SETTINGS];

  return (
    <nav
      aria-label="Sections"
      className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-3 py-2 lg:hidden"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-2.5 py-1 text-sm",
              active ? "bg-accent-50 font-medium text-accent-800" : "text-zinc-600",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
