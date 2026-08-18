import { Briefcase, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { JobStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { Pagination, Table, Td, Th, Tr } from "@/components/ui/table";
import { listJobs } from "@/lib/api/queries";
import { STORAGE_TARGET_LABELS, type JobStatus } from "@/lib/api/types";
import { formatDate, pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Jobs" };

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "closed", label: "Closed" },
];

const PAGE_SIZE = 25;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; offset?: string }>;
}) {
  const params = await searchParams;
  const status = STATUS_TABS.some((tab) => tab.value === params.status) ? params.status ?? "" : "";
  const search = (params.q ?? "").trim();
  const offset = Number(params.offset ?? 0) || 0;

  // The admin API has no title search parameter, so search pulls a full page (the API caps limit
  // at 100) and filters locally. Fine at v0.1 volumes; a `q` parameter server-side would be better.
  const page = await listJobs({
    status: status || undefined,
    limit: search ? 100 : PAGE_SIZE,
    offset: search ? 0 : offset,
  });

  const jobs = search
    ? page.items.filter((job) =>
        [job.title, job.location, job.department]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(search.toLowerCase())),
      )
    : page.items;

  const buildHref = (next: Partial<{ status: string; q: string; offset: number }>) => {
    const query = new URLSearchParams();
    const nextStatus = next.status ?? status;
    const nextSearch = next.q ?? search;
    const nextOffset = next.offset ?? (next.status !== undefined || next.q !== undefined ? 0 : offset);
    if (nextStatus) query.set("status", nextStatus);
    if (nextSearch) query.set("q", nextSearch);
    if (nextOffset) query.set("offset", String(nextOffset));
    const encoded = query.toString();
    return `/jobs${encoded ? `?${encoded}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Every role in this workspace. Only published jobs are visible on the public API."
        actions={
          <LinkButton href="/jobs/new" icon={<Plus className="size-4" />}>
            New job
          </LinkButton>
        }
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by status" className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value || "all"}
              href={buildHref({ status: tab.value })}
              aria-current={status === tab.value ? "true" : undefined}
              className={
                status === tab.value
                  ? "rounded-md bg-copper-bright px-2.5 py-1 text-sm font-medium text-ink"
                  : "rounded-md px-2.5 py-1 text-sm text-dim hover:bg-[var(--ink-soft)] hover:text-paper"
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <form action="/jobs" className="flex items-center gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search title, location, department"
            aria-label="Search jobs"
            className="h-8 w-64 rounded-md border border-[var(--line-soft)] bg-[var(--ink-soft)] px-2.5 text-sm text-paper placeholder:text-dim"
          />
          <button
            type="submit"
            className="h-8 rounded-md border border-[var(--line-soft)] bg-[var(--ink-soft)] px-2.5 text-sm text-dim transition-colors hover:text-paper"
          >
            Search
          </button>
        </form>
      </div>

      <Card>
        {jobs.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="size-6" />}
            title={search ? `Nothing matches “${search}”` : "No jobs here yet"}
            body={
              search
                ? "Try a shorter search, or clear it to see everything in this workspace."
                : "A job holds the role details and the questions applicants answer. Create one, publish it, and your career page can fetch it immediately."
            }
            action={
              search ? (
                <LinkButton href={buildHref({ q: "" })} variant="secondary" size="sm">
                  Clear search
                </LinkButton>
              ) : (
                <LinkButton href="/jobs/new" size="sm">
                  Create a job
                </LinkButton>
              )
            }
          />
        ) : (
          <>
            <Table caption="Job posts">
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Status</Th>
                  <Th>Questions</Th>
                  <Th>Files go to</Th>
                  <Th className="text-right">Created</Th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <Tr key={job.id}>
                    <Td>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-medium text-paper hover:text-copper-bright hover:underline"
                      >
                        {job.title}
                      </Link>
                      <p className="text-xs text-dim">
                        {[job.department, job.location, job.employment_type]
                          .filter(Boolean)
                          .join(" · ") || "No location set"}
                      </p>
                    </Td>
                    <Td>
                      <JobStatusBadge status={job.status as JobStatus} />
                    </Td>
                    <Td className="text-dim">{pluralize(job.questions.length, "question")}</Td>
                    <Td className="text-dim">{STORAGE_TARGET_LABELS[job.storage_target]}</Td>
                    <Td className="text-right text-xs text-dim">{formatDate(job.created_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            {search ? (
              <p className="border-t border-[var(--line-soft)] px-3 py-2 font-mono text-xs text-dim">
                Showing {jobs.length} of {page.total} jobs matching “{search}”.
              </p>
            ) : (
              <Pagination
                total={page.total}
                limit={PAGE_SIZE}
                offset={offset}
                buildHref={(nextOffset) => buildHref({ offset: nextOffset })}
              />
            )}
          </>
        )}
      </Card>
    </>
  );
}
