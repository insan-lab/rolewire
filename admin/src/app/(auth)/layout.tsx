import Link from "next/link";
import type { ReactNode } from "react";

/** Centered card shell for authentication screens — no sidebar, no session required. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50">
      <header className="px-5 py-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-zinc-900"
        >
          <span aria-hidden className="size-2.5 rounded-sm bg-accent-600" />
          Rolewire
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-5 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
