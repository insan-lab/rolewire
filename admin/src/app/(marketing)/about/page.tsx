import type { Metadata } from "next";
import Link from "next/link";

import { SUPPORT_EMAIL } from "@/lib/env";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Rolewire is built API-first: no hosted career page, no applicant-facing UI, and your files stay in your storage.",
};

export const revalidate = 3600;

/*
 * TODO(rolewire): replace the bracketed placeholders below with the real company details —
 * founding year, legal entity, location and who is behind it. Left as placeholders on purpose:
 * inventing a team or an address here would be worse than an obvious gap, and this page's whole
 * job is to read as a real business (frontend spec §3.2).
 */
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-paper">
        About Rolewire
      </h1>

      <div className="prose-plain mt-6 space-y-4">
        <p>
          Rolewire is a job posting and application collection API. It gives a company the operational
          half of hiring — a place to write the role, define exactly what applicants must answer, and
          read what comes back — and deliberately stops before the part everyone wants to own
          themselves: the career page.
        </p>
        <p>
          Most hiring tools work the other way round. They host the job board, put their branding and
          their URL in front of your candidates, and hand you a widget or an iframe if you want it on
          your own site. That is a reasonable product for a company with no engineers. It is a poor
          fit for one that has a design system, a marketing site and opinions about both.
        </p>
        <h2 className="pt-2 text-base font-semibold text-paper">Why headless</h2>
        <p>
          The public API is two endpoints: list published jobs, and fetch one job with its typed
          questions. A third accepts the application. That is enough to build any career page —
          server-rendered, static, single-page, native app — without asking us for a feature. Nothing
          applicant-facing is rendered by Rolewire, so nothing applicant-facing is ours to break.
        </p>
        <h2 className="pt-2 text-base font-semibold text-paper">Why your storage</h2>
        <p>
          Résumés are the sensitive part of hiring, and charging rent on them is an odd business to
          be in. Connect an S3 bucket, a Google Drive folder or a Telegram channel and applicant
          files upload directly there from the applicant&apos;s browser — they never pass through our
          servers. If you would rather not run storage, the hosted tier exists with a quota included
          in every plan.
        </p>
        <h2 className="pt-2 text-base font-semibold text-paper">Who builds it</h2>
        <p>
          Rolewire is built by <strong className="text-paper">[company/team name]</strong>, based in{" "}
          <strong className="text-paper">[city, country]</strong>, working on it since{" "}
          <strong className="text-paper">[year]</strong>. It is a small team, which is why the
          product is narrow on purpose: one job done properly rather than an all-in-one suite
          maintained badly.
        </p>
        <p>
          Payments run through Paddle for customers outside Bangladesh and UddoktaPay for customers
          inside it, so local teams can pay with bKash or Nagad instead of hunting for a card that
          works internationally.
        </p>
      </div>

      <div
        className="mt-10 rounded-lg border p-5"
        style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
      >
        <h2 className="text-sm font-semibold text-paper">Questions before you sign up?</h2>
        <p className="mt-1 text-sm text-dim">
          Write to{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-copper-bright hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          or use the{" "}
          <Link href="/contact" className="font-medium text-copper-bright hover:underline">
            contact form
          </Link>
          . A person answers.
        </p>
      </div>
    </div>
  );
}
