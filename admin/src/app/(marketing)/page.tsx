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
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
            <span aria-hidden className="size-1.5 rounded-full bg-accent-500" />
            Job posting API · v0.1
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-4xl">
            Job posting and application collection, without the hosted career page.
          </h1>
          <p className="prose-plain mt-4 max-w-xl text-base">
            Rolewire gives you the admin panel, the application schema and the storage plumbing. Your
            developers keep full control of the career page: two public endpoints, no widget, no
            iframe, no Rolewire branding on your site.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-accent-600 px-4 text-sm font-medium text-white hover:bg-accent-700"
            >
              Create an account <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Sign up with email, or with Google, GitHub, LinkedIn or Facebook.
          </p>
        </div>

        <div className="lg:pl-4">
          <p className="mb-2 font-mono text-xs text-zinc-500">GET /v1/public/jobs/{"{job_id}"}</p>
          <CodeBlock code={JOB_RESPONSE} label="200 application/json" maxHeight="28rem" />
          <p className="mt-2 text-xs text-zinc-500">
            No authentication, CORS open to any origin, typed questions your form can render
            directly.
          </p>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">How it works</h2>
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

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
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

      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Simple pricing</h2>
              <p className="prose-plain mt-1">
                Flat monthly price per company. Unlimited jobs and applications on every plan.
              </p>
            </div>
            <div className="flex gap-4 text-sm">
              <Link href="/pricing" className="font-medium text-accent-700 hover:underline">
                Global pricing (USD)
              </Link>
              <Link href="/pricing/bd" className="font-medium text-accent-700 hover:underline">
                Bangladesh pricing (BDT)
              </Link>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">{plan.title}</h3>
                  <p className="text-sm text-zinc-500">
                    <span className="text-xl font-semibold text-zinc-900">${plan.usd.monthly}</span>
                    /month
                  </p>
                </div>
                <p className="mt-2 text-sm text-zinc-600">{plan.tagline}</p>
                <p className="mt-3 text-xs text-zinc-500">
                  ৳{plan.bdt.monthly}/month if you pay in Bangladesh
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
          Start posting in a few minutes
        </h2>
        <p className="prose-plain mx-auto mt-2 max-w-xl">
          Create an account, publish your first role, and point your career page at the public API.
          No sales call, no implementation project.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-accent-600 px-4 text-sm font-medium text-white hover:bg-accent-700"
          >
            Create an account <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
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
    <li className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card">
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-accent-600 text-xs font-semibold text-white">
        {number}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{body}</p>
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
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-card">
      <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <span className="text-accent-600">{icon}</span>
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{body}</p>
    </div>
  );
}
