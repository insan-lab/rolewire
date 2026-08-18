import Link from "next/link";
import type { ReactNode } from "react";

import { SessionLinks } from "@/components/marketing/session-links";
import { SUPPORT_EMAIL } from "@/lib/env";

/**
 * Public marketing shell: no sidebar, no session requirement.
 *
 * Deliberately does *not* read cookies — that would force every marketing page into dynamic
 * rendering and give up the SSG/ISR the spec asks for (§3.1). The auth-aware header link is a
 * small Client Component that asks /api/auth/session after hydration instead.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-5">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-zinc-900">
            <Wordmark />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-zinc-600 md:flex">
            <Link href="/pricing" className="hover:text-zinc-900">
              Pricing
            </Link>
            <Link href="/about" className="hover:text-zinc-900">
              About
            </Link>
            <Link href="/contact" className="hover:text-zinc-900">
              Contact
            </Link>
          </nav>
          <SessionLinks />
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-zinc-600 md:flex-row md:justify-between">
          <div className="space-y-2">
            <Wordmark />
            <p className="max-w-xs text-xs text-zinc-500">
              Headless job posting and application collection. You keep the career page, the design
              and the files.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-xs sm:grid-cols-3">
            <FooterColumn title="Product">
              <Link href="/pricing">Pricing (global)</Link>
              <Link href="/pricing/bd">Pricing (Bangladesh)</Link>
              <Link href="/signup">Create an account</Link>
            </FooterColumn>
            <FooterColumn title="Company">
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
            </FooterColumn>
            <FooterColumn title="Support">
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </FooterColumn>
          </div>
        </div>
        <div className="border-t border-zinc-200 px-5 py-4 text-center text-xs text-zinc-400">
          © {new Date().getFullYear()} Rolewire
        </div>
      </footer>
    </div>
  );
}

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-2.5 rounded-sm bg-accent-600" />
      <span>Rolewire</span>
    </span>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <div className="flex flex-col gap-1.5 [&_a:hover]:text-zinc-900">{children}</div>
    </div>
  );
}
