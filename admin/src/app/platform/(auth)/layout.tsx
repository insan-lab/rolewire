import type { ReactNode } from "react";

/** Centered card shell for the platform login screen — no sidebar, no session required. */
export default function PlatformAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950">
      <header className="px-5 py-5">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-white">
          <span aria-hidden className="size-2.5 rounded-sm bg-accent-500" />
          Rolewire Platform
        </span>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-5 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
