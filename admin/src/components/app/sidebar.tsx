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
      className="hidden w-56 shrink-0 flex-col border-r lg:flex"
      style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
    >
      <div
        className="flex h-14 items-center gap-2 border-b px-4"
        style={{ borderColor: "var(--line-soft)" }}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 font-mono text-sm font-medium text-paper"
        >
          <span aria-hidden className="size-2 rounded-full bg-copper-bright" />
          Rolewire
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <NavGroup items={MAIN} />
        <p className="mt-5 px-2 pb-1 font-mono text-2xs font-semibold uppercase tracking-wider text-dim">
          Settings
        </p>
        <NavGroup items={SETTINGS} />
      </div>

      <div className="border-t px-4 py-3" style={{ borderColor: "var(--line-soft)" }}>
        <p className="truncate text-xs font-medium text-paper" title={userEmail}>
          {userEmail}
        </p>
        <p className="text-2xs capitalize text-dim">{role}</p>
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
                "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                active
                  ? "font-medium text-paper"
                  : "text-dim hover:text-paper",
              )}
              style={active ? { background: "rgba(226,147,79,0.12)" } : undefined}
            >
              <span
                className={active ? "text-copper-bright" : "text-dim"}
              >
                {item.icon}
              </span>
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
      className="flex gap-1 overflow-x-auto border-b px-3 py-2 lg:hidden"
      style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-2.5 py-1 text-sm transition-colors",
              active ? "font-medium text-paper" : "text-dim",
            )}
            style={active ? { background: "rgba(226,147,79,0.12)" } : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
