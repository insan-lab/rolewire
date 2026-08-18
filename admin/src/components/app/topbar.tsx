"use client";

import { ChevronDown, ExternalLink, LogOut, Plus, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { LinkButton } from "@/components/ui/button";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/overlay";
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
    <header className="flex h-14 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-800 lg:hidden">Rolewire</p>
      </div>

      <div className="flex items-center gap-2">
        <LinkButton href="/jobs/new" size="sm" icon={<Plus className="size-4" />}>
          New job
        </LinkButton>

        <DropdownMenu
          trigger={
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-zinc-700 hover:bg-zinc-100"
              aria-label="Account menu"
            >
              <span className="grid size-6 place-items-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-700">
                {user.email.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-40 truncate sm:block">{user.email}</span>
              <ChevronDown className="size-3.5 text-zinc-400" />
            </button>
          }
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-zinc-900">{user.email}</p>
            <p className="text-xs capitalize text-zinc-500">{user.role}</p>
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
