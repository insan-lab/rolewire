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
    <div className="flex min-h-dvh flex-col bg-ink">
      <header
        className="sticky top-0 z-30 border-b border-line-soft bg-ink/90 backdrop-blur"
        style={{ borderColor: "var(--line-soft)" }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-5">
          <Link href="/" className="flex items-center gap-2 text-paper">
            <Wordmark />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-dim md:flex">
            <Link href="/pricing" className="transition-colors hover:text-paper">
              Pricing
            </Link>
            <Link href="/about" className="transition-colors hover:text-paper">
              About
            </Link>
            <Link href="/contact" className="transition-colors hover:text-paper">
              Contact
            </Link>
          </nav>
          <SessionLinks />
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t bg-ink-soft" style={{ borderColor: "var(--line-soft)" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-dim md:flex-row md:justify-between">
          <div className="space-y-2">
            <Wordmark />
            <p className="max-w-xs text-xs text-dim">
              Headless job posting and application collection. You keep the career page, the design
              and the files.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-xs sm:grid-cols-4">
            <FooterColumn title="Product">
              <Link href="/pricing">Pricing (global)</Link>
              <Link href="/pricing/bd">Pricing (Bangladesh)</Link>
              <Link href="/signup">Create an account</Link>
            </FooterColumn>
            <FooterColumn title="Company">
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
            </FooterColumn>
            <FooterColumn title="Legal">
              <Link href="/terms">Terms of Service</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/refund-policy">Refund Policy</Link>
            </FooterColumn>
            <FooterColumn title="Support">
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </FooterColumn>
          </div>
        </div>
        <div
          className="border-t px-5 py-4 text-center text-xs text-dim"
          style={{ borderColor: "var(--line-soft)" }}
        >
          © {new Date().getFullYear()} Rolewire
        </div>
      </footer>
    </div>
  );
}

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-sm font-medium tracking-tight">
      {/* copper-bright signal dot — the brand's wire accent */}
      <span aria-hidden className="size-2 rounded-full bg-copper-bright" />
      <span className="text-paper">Rolewire</span>
    </span>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[0.65rem] font-medium uppercase tracking-widest text-dim">
        {title}
      </p>
      <div className="flex flex-col gap-1.5 [&_a]:text-dim [&_a]:transition-colors [&_a:hover]:text-paper">
        {children}
      </div>
    </div>
  );
}
