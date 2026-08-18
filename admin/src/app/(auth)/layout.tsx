import Link from "next/link";
import type { ReactNode } from "react";

/** Centered card shell for authentication screens — no sidebar, no session required. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-ink">
      <header className="px-5 py-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-sm font-medium tracking-tight text-paper"
        >
          <span aria-hidden className="size-2 rounded-full bg-copper-bright" />
          Rolewire
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-5 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
