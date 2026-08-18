"use client";

import { ChevronDown, ExternalLink, LogOut, Plus, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { LinkButton } from "@/components/ui/button";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/overlay";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { User } from "@/lib/api/types";

export function Topbar({ user, docsUrl }: { user: User; docsUrl: string }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    // Full reload so no stale Server Component payload survives the session change.
    window.location.assign("/login");
  }

  return (
    <header
      className="flex h-14 items-center justify-between gap-4 border-b px-4"
      style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
    >
      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-medium text-paper lg:hidden">Rolewire</p>
      </div>

      <div className="flex items-center gap-1">
        <LinkButton href="/jobs/new" size="sm" icon={<Plus className="size-4" />}>
          New job
        </LinkButton>

        {/* Theme toggle */}
        <ThemeToggle />

        <DropdownMenu
          trigger={
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-dim transition-colors hover:bg-[var(--ink)] hover:text-paper"
              aria-label="Account menu"
            >
              <span
                className="grid size-6 place-items-center rounded-full font-mono text-xs font-medium text-ink"
                style={{ backgroundColor: "var(--copper-bright)" }}
              >
                {user.email.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-40 truncate sm:block">{user.email}</span>
              <ChevronDown className="size-3.5 text-dim" />
            </button>
          }
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-paper">{user.email}</p>
            <p className="font-mono text-xs capitalize text-dim">{user.role}</p>
          </div>
          <DropdownSeparator />
          <DropdownItem>
            <Link href="/settings/account" className="flex flex-1 items-center gap-2">
              <UserIcon className="size-4" /> Account settings
            </Link>
          </DropdownItem>
          <DropdownItem>
            <a
              href={docsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center gap-2"
            >
              <ExternalLink className="size-4" /> API reference
            </a>
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem destructive onSelect={logout} disabled={loggingOut}>
            <LogOut className="size-4" /> {loggingOut ? "Logging out…" : "Log out"}
          </DropdownItem>
        </DropdownMenu>
      </div>
    </header>
  );
}
