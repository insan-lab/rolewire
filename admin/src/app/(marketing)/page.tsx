import { ArrowRight, Cloud, FolderTree, Send, Server } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CodeBlock } from "@/components/ui/code-block";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Rolewire — headless job posting and application API",
  description:
    "Post jobs from a clean admin panel, embed them on your own career page with two API calls, and keep every résumé in your own S3, Drive or Telegram.",
};

// Content changes rarely, and this is the page most exposed to cold/SEO traffic (spec §3.1).
export const revalidate = 3600;

/** The actual shape of GET /v1/public/jobs/{job_id} (backend spec §5.1). */
const JOB_RESPONSE = `{
  "id": "3870209f-097b-4e98-a5ff-bc52c6ad40d5",
  "title": "Backend Engineer",
  "location": "Dhaka / remote",
  "employment_type": "full_time",
  "department": "Engineering",
  "created_at": "2025-03-04T09:12:44Z",
  "description": "We are looking for...",
  "company": "Northwind Ltd",
  "questions": [
    { "field_key": "full_name", "label": "Full name",
      "type": "text", "options": null, "required": true },
    { "field_key": "years_experience", "label": "Years of experience",
      "type": "number", "options": null, "required": true },
    { "field_key": "notice_period", "label": "Notice period",
      "type": "select", "options": ["Immediate", "2 weeks", "1 month"],
      "required": true },
    { "field_key": "resume", "label": "Résumé",
      "type": "file", "options": null, "required": true }
  ]
}`;

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div>
          {/* Eyebrow tag — copper-bright signal dot, IBM Plex Mono text */}
          <p
            className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs text-dim"
            style={{ borderColor: "var(--line-soft)", background: "var(--ink-soft)" }}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-copper-bright" />
            Job posting API · v0.1
          </p>

          {/* Headline — Fraunces editorial serif */}
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-paper sm:text-4xl lg:text-[2.625rem] lg:leading-[1.15]">
            Job posting and application collection,{" "}
            <em className="font-display not-italic text-copper-bright">
              without the hosted career page.
            </em>
          </h1>

          <p className="prose-plain mt-5 max-w-xl text-base">
            Rolewire gives you the admin panel, the application schema and the storage plumbing. Your
            developers keep full control of the career page: two public endpoints, no widget, no
            iframe, no Rolewire branding on your site.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium text-ink transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--copper-bright)" }}
            >
              Create an account <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium text-dim transition-colors hover:text-paper"
              style={{ borderColor: "var(--line-soft)" }}
            >
              See pricing
            </Link>
          </div>
          <p className="mt-3 font-mono text-xs text-dim">
            Sign up with email, or with Google, GitHub, LinkedIn or Facebook.
          </p>
        </div>

        <div className="lg:pl-4">
          {/* Route label — IBM Plex Mono, signal green for the HTTP method */}
          <p className="mb-2 font-mono text-xs">
            <span className="text-signal">GET</span>{" "}
            <span className="text-dim">/v1/public/jobs/{"{job_id}"}</span>
          </p>
          <CodeBlock code={JOB_RESPONSE} label="200 application/json" maxHeight="28rem" />
          <p className="mt-2 font-mono text-xs text-dim">
            No authentication, CORS open to any origin, typed questions your form can render
            directly.
          </p>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="border-y bg-ink-soft" style={{ borderColor: "var(--line-soft)" }}>
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="font-display text-xl font-semibold tracking-tight text-paper">
            How it works
          </h2>
          <p className="prose-plain mt-1 max-w-2xl">
            Three steps, in this order. Nothing applicant-facing is ever rendered by us.
          </p>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            <Step
              number={1}
              title="Post the job in the panel"
              body="Write the role, then build the application form question by question — short text, choices, numbers, file uploads. Each question gets a stable field key your code reads."
            />
            <Step
              number={2}
              title="Embed it on your career page"
              body="List published roles and fetch one job with its questions. Render the form however your design system says it should look, then POST the answers back."
            />
            <Step
              number={3}
              title="Receive applications where you already work"
              body="Answers land in the panel; files land in your own bucket, Drive folder or Telegram channel. Every application can also be forwarded to your ATS webhook."
            />
          </ol>
        </div>
      </section>

      {/* ── Storage section ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-paper">
              Your résumés stay in your storage
            </h2>
            <p className="prose-plain mt-2">
              Most job tools keep applicant files hostage and charge for the privilege. Rolewire
              treats storage as your choice: connect a destination once and files upload straight
              from the applicant&apos;s browser to it — never through a Rolewire disk we then bill
              you for.
            </p>
            <p className="prose-plain mt-4">
              Prefer not to run storage at all? The hosted tier is there, with a quota included in
              every plan.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StorageCard
              icon={<Cloud className="size-4" />}
              title="Amazon S3 or compatible"
              body="Any S3 API: AWS, DigitalOcean Spaces, Backblaze, MinIO. Presigned uploads, your bucket policy."
            />
            <StorageCard
              icon={<FolderTree className="size-4" />}
              title="Google Drive"
              body="A service account writes into the folder you nominate. Files appear where your HR team already looks."
            />
            <StorageCard
              icon={<Send className="size-4" />}
              title="Telegram channel"
              body="Small teams that live in Telegram get each résumé posted to a private channel as it arrives."
            />
            <StorageCard
              icon={<Server className="size-4" />}
              title="Rolewire hosted"
              body="Nothing to configure. Included quota per plan, metered beyond it."
            />
          </div>
        </div>
      </section>

      {/* ── Pricing preview ─────────────────────────────────────────────────── */}
      <section className="border-t bg-ink-soft" style={{ borderColor: "var(--line-soft)" }}>
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-paper">
                Simple pricing
              </h2>
              <p className="prose-plain mt-1">
                Flat monthly price per company. Unlimited jobs and applications on every plan.
              </p>
            </div>
            <div className="flex gap-4 font-mono text-xs">
              <Link
                href="/pricing"
                className="text-copper-bright transition-colors hover:text-copper"
              >
                Global pricing (USD)
              </Link>
              <Link
                href="/pricing/bd"
                className="text-copper-bright transition-colors hover:text-copper"
              >
                Bangladesh pricing (BDT)
              </Link>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="rounded-lg border p-5 transition-colors"
                style={{
                  background: "var(--ink)",
                  borderColor: "var(--line-soft)",
                }}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-paper">{plan.title}</h3>
                  <p className="text-sm text-dim">
                    <span className="text-xl font-semibold text-paper">${plan.usd.monthly}</span>
                    /month
                  </p>
                </div>
                <p className="mt-2 text-sm text-dim">{plan.tagline}</p>
                <p className="mt-3 font-mono text-xs text-dim">
                  ৳{plan.bdt.monthly}/month if you pay in Bangladesh
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-paper">
          Start posting in a few minutes
        </h2>
        <p className="prose-plain mx-auto mt-2 max-w-xl">
          Create an account, publish your first role, and point your career page at the public API.
          No sales call, no implementation project.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium text-ink transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--copper-bright)" }}
          >
            Create an account <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium text-dim transition-colors hover:text-paper"
            style={{ borderColor: "var(--line-soft)" }}
          >
            Ask a question first
          </Link>
        </div>
      </section>
    </>
  );
}

function Step({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <li
      className="rounded-lg border p-5"
      style={{ background: "var(--ink)", borderColor: "var(--line-soft)" }}
    >
      {/* Step number — copper-bright circle */}
      <span
        className="inline-flex size-6 items-center justify-center rounded-full font-mono text-xs font-semibold text-ink"
        style={{ backgroundColor: "var(--copper-bright)" }}
      >
        {number}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-paper">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-dim">{body}</p>
    </li>
  );
}

function StorageCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-lg border p-4 transition-colors"
      style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-paper">
        <span className="text-copper-bright">{icon}</span>
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-dim">{body}</p>
    </div>
  );
}

