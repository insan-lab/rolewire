import { ArrowUpRight, Briefcase, Inbox, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ApplicationStatusBadge, TenantStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Callout, EmptyState, PageHeader, Stat } from "@/components/ui/surface";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { getBillingOverview, listApplications, listJobs } from "@/lib/api/queries";
import type { BillingOverview, Job, Page } from "@/lib/api/types";
import { applicantLabel, formatBytesFromMb, pluralize, relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;

  // One round-trip each, in parallel: totals come from the page envelope, so limit=1 is enough.
  const [published, drafts, closed, recent, billing] = await Promise.all([
    listJobs({ status: "published", limit: 1 }),
    listJobs({ status: "draft", limit: 1 }),
    listJobs({ status: "closed", limit: 1 }),
    listApplications({ limit: 8 }),
    getBillingOverview().catch(() => null),
  ]);

  const hasJobs = published.total + drafts.total + closed.total > 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Everything happening across your job posts right now."
        actions={
          <LinkButton href="/jobs/new" icon={<Plus className="size-4" />}>
            New job
          </LinkButton>
        }
      />

      {welcome ? (
        <Callout tone="info" title="Your workspace is ready" className="mb-5">
          Create a job, add the questions applicants must answer, then point your career page at{" "}
          <code className="font-mono text-xs">GET /v1/public/jobs</code>. Nothing is visible publicly
          until you publish.
        </Callout>
      ) : null}

      {billing?.tenant_status === "suspended" ? (
        <Callout tone="danger" title="Public endpoints are returning 410 Gone" className="mb-5">
          This workspace is suspended, so your career page cannot load jobs or accept applications.{" "}
          <Link href="/billing" className="font-medium underline">
            Review billing
          </Link>{" "}
          to restore it.
        </Callout>
      ) : null}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="divide-y divide-zinc-100">
          <Stat label="Published" value={published.total} hint="Visible on your career page" />
        </Card>
        <Card>
          <Stat label="Drafts" value={drafts.total} hint="Not visible publicly" />
        </Card>
        <Card>
          <Stat label="Closed" value={closed.total} hint="Kept for their applications" />
        </Card>
        <Card>
          <Stat
            label="Applications"
            value={recent.total}
            hint={recent.total > 0 ? "All time" : "None yet"}
          />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Recent applications"
            description={recent.total > 0 ? pluralize(recent.total, "application") + " in total" : undefined}
            actions={
              recent.total > 0 ? (
                <Link
                  href="/applications"
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 hover:underline"
                >
                  Open inbox <ArrowUpRight className="size-3.5" />
                </Link>
              ) : null
            }
          />
          {recent.items.length === 0 ? (
            <EmptyState
              icon={<Inbox className="size-6" />}
              title="No applications yet"
              body={
                hasJobs
                  ? "When someone submits your form, the answers appear here within seconds — and the résumé lands in the storage you chose for that job."
                  : "Publish a job first. Applications arrive here as soon as your career page starts posting to the public API."
              }
              action={
                hasJobs ? null : (
                  <LinkButton href="/jobs/new" size="sm">
                    Create your first job
                  </LinkButton>
                )
              }
            />
          ) : (
            <Table caption="Most recent applications">
              <thead>
                <tr>
                  <Th>Applicant</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Received</Th>
                </tr>
              </thead>
              <tbody>
                {recent.items.map((application) => (
                  <Tr key={application.id}>
                    <Td>
                      <Link
                        href={`/applications/${application.id}`}
                        className="font-medium text-zinc-900 hover:text-accent-700 hover:underline"
                      >
                        {applicantLabel(application)}
                      </Link>
                    </Td>
                    <Td>
                      <ApplicationStatusBadge status={application.status} />
                    </Td>
                    <Td className="text-right text-xs text-zinc-500">
                      {relativeTime(application.created_at)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-5">
          <PlanCard billing={billing} />
          <NextSteps jobs={published} drafts={drafts} />
        </div>
      </div>
    </>
  );
}

function PlanCard({ billing }: { billing: BillingOverview | null }) {
  if (!billing) {
    return (
      <Card>
        <CardHeader title="Plan" />
        <CardBody>
          <p className="text-sm text-zinc-500">Billing information is unavailable right now.</p>
        </CardBody>
      </Card>
    );
  }

  const storageMb = Number(billing.usage.storage_mb ?? 0);
  const applications = Number(billing.usage.application_received ?? 0);

  return (
    <Card>
      <CardHeader
        title="Plan"
        actions={<TenantStatusBadge status={billing.tenant_status} />}
      />
      <CardBody className="space-y-3">
        <div>
          <p className="text-sm font-medium capitalize text-zinc-900">
            {billing.plan?.name ?? "No plan yet"}
          </p>
          <p className="text-xs text-zinc-500">
            {billing.payment_provider
              ? `Billed through ${billing.payment_provider}`
              : "No payment method connected"}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">Hosted storage</dt>
            <dd className="font-medium text-zinc-900">{formatBytesFromMb(storageMb)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Applications metered</dt>
            <dd className="font-medium text-zinc-900">{applications}</dd>
          </div>
        </dl>
        <Link href="/billing" className="inline-block text-xs font-medium text-accent-700 hover:underline">
          Billing details
        </Link>
      </CardBody>
    </Card>
  );
}

function NextSteps({ jobs, drafts }: { jobs: Page<Job>; drafts: Page<Job> }) {
  const steps = [
    {
      done: jobs.total + drafts.total > 0,
      title: "Create a job",
      body: "Write the role and define the questions applicants must answer.",
      href: "/jobs/new",
    },
    {
      done: jobs.total > 0,
      title: "Publish it",
      body: "Only published jobs appear on the public endpoints.",
      href: "/jobs",
    },
    {
      done: false,
      title: "Choose where files go",
      body: "Connect S3, Google Drive or Telegram, or stay on hosted storage.",
      href: "/settings/storage",
    },
  ];

  return (
    <Card>
      <CardHeader title="Getting set up" />
      <ul className="divide-y divide-zinc-100">
        {steps.map((step) => (
          <li key={step.title} className="flex gap-3 px-4 py-3">
            <span
              aria-hidden
              className={
                step.done
                  ? "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-600 text-[0.6rem] text-white"
                  : "mt-1 size-4 shrink-0 rounded-full border border-zinc-300"
              }
            >
              {step.done ? "✓" : null}
            </span>
            <div className="min-w-0">
              <Link href={step.href} className="text-sm font-medium text-zinc-900 hover:underline">
                {step.title}
              </Link>
              <p className="text-xs text-zinc-500">{step.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <CardBody className="border-t border-zinc-100 text-xs text-zinc-500">
        <Briefcase className="mr-1 inline size-3.5 align-[-2px] text-zinc-400" />
        Your career page reads two endpoints and posts to a third — no SDK required.
      </CardBody>
    </Card>
  );
}
