"use client";

import { Briefcase, Building2, CreditCard, LayoutDashboard, LogOut, Mail, Tag, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type NavItem = { href: string; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  { href: "/platform", label: "Overview", icon: <LayoutDashboard className="size-4" /> },
  { href: "/platform/companies", label: "Companies", icon: <Building2 className="size-4" /> },
  { href: "/platform/users", label: "Users", icon: <Users className="size-4" /> },
  { href: "/platform/jobs", label: "Jobs", icon: <Briefcase className="size-4" /> },
  { href: "/platform/billing", label: "Billing", icon: <CreditCard className="size-4" /> },
  { href: "/platform/plans", label: "Plans", icon: <Tag className="size-4" /> },
  { href: "/platform/contact", label: "Messages", icon: <Mail className="size-4" /> },
];

export function PlatformSidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="flex w-56 shrink-0 flex-col border-r"
      style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
    >
      <div
        className="flex h-14 items-center gap-2 border-b px-4"
        style={{ borderColor: "var(--line-soft)" }}
      >
        <Link
          href="/platform"
          className="flex items-center gap-1.5 font-mono text-sm font-medium text-paper"
        >
          <span aria-hidden className="size-2 rounded-full bg-copper-bright" />
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
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active ? "font-medium text-paper" : "text-dim hover:text-paper",
                )}
                style={active ? { background: "rgba(226,147,79,0.12)" } : undefined}
              >
                <span className={active ? "text-copper-bright" : "text-dim"}>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div
        className="border-t px-4 py-3"
        style={{ borderColor: "var(--line-soft)" }}
      >
        <p className="truncate text-xs font-medium text-paper" title={adminEmail}>
          {adminEmail}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <LogoutButton />
          <ThemeToggle className="rounded-md p-1 text-dim transition-colors hover:bg-[var(--ink)] hover:text-paper" />
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
      className="inline-flex items-center gap-1.5 text-xs text-dim transition-colors hover:text-paper"
    >
      <LogOut className="size-3.5" />
      Log out
    </button>
  );
}
