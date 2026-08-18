"use client";

import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ApplicationDrawer } from "@/components/app/application-drawer";
import { ApplicationStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/surface";
import { Pagination, Table, Td, Th, Tr } from "@/components/ui/table";
import { apiFetch } from "@/lib/api/browser";
import type { Application, Job, JobQuestion, Page } from "@/lib/api/types";
import { applicantLabel, relativeTime } from "@/lib/utils";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "received", label: "Received" },
  { value: "forwarded", label: "Forwarded" },
  { value: "failed", label: "Failed" },
];

/** Every application worth an admin's attention is either new or broken. */
const POLL_INTERVAL_MS = 30_000;

export function ApplicationsInbox({
  initialPage,
  basePath,
  jobId,
  status,
  offset,
  limit,
  jobsForFilter,
}: {
  initialPage: Page<Application>;
  /** Route this table is mounted on, for building filter/pagination links. */
  basePath: string;
  /** Fixed when this table is scoped to one job's page; otherwise the `?job=` filter applies. */
  jobId?: string;
  status: string;
  offset: number;
  limit: number;
  /** Present only on the cross-job inbox, to show a Job column and a job filter. */
  jobsForFilter?: Job[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["applications", jobId ?? "all", status, offset, limit],
    queryFn: () =>
      apiFetch<Page<Application>>(
        `/v1/admin/applications${buildQuery({ job_id: jobId, limit, offset: status ? 0 : offset })}`,
      ),
    initialData: initialPage,
    refetchInterval: POLL_INTERVAL_MS,
  });

  const items = status ? data.items.filter((application) => application.status === status) : data.items;
  const jobsById = new Map((jobsForFilter ?? []).map((job) => [job.id, job]));
  const open = openId ? (items.find((item) => item.id === openId) ?? null) : null;
  const openJobId = open?.job_id ?? jobId;

  const { data: openJob } = useQuery({
    queryKey: ["job-questions", openJobId],
    queryFn: () => apiFetch<Job>(`/v1/admin/jobs/${openJobId}`),
    enabled: Boolean(openId && openJobId),
    staleTime: 5 * 60_000,
  });

  const buildHref = (next: Partial<{ status: string; job: string; offset: number }>) => {
    const query = new URLSearchParams();
    const nextStatus = next.status ?? status;
    const nextJob = next.job ?? (jobId ?? "");
    const nextOffset = next.offset ?? (next.status !== undefined || next.job !== undefined ? 0 : offset);
    if (nextStatus) query.set("status", nextStatus);
    if (!jobId && nextJob) query.set("job", nextJob);
    if (nextOffset) query.set("offset", String(nextOffset));
    const encoded = query.toString();
    return `${basePath}${encoded ? `?${encoded}` : ""}`;
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by status" className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value || "all"}
              href={buildHref({ status: tab.value })}
              aria-current={status === tab.value ? "true" : undefined}
              className={
                status === tab.value
                  ? "rounded-md bg-zinc-900 px-2.5 py-1 text-sm font-medium text-white"
                  : "rounded-md px-2.5 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {jobsForFilter ? (
          <form action={basePath} className="flex items-center gap-2">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <select
              name="job"
              defaultValue={jobId ?? ""}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-700"
            >
              <option value="">All jobs</option>
              {jobsForFilter.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </form>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6" />}
          title={status ? `No ${status} applications` : "No applications yet"}
          body="Applications arrive here within seconds of someone submitting your public form. This view refreshes automatically."
        />
      ) : (
        <>
          <Table caption="Applications">
            <thead>
              <tr>
                <Th>Applicant</Th>
                {jobsForFilter ? <Th>Job</Th> : null}
                <Th>Status</Th>
                <Th className="text-right">Received</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((application) => (
                <Tr key={application.id} onClick={() => setOpenId(application.id)}>
                  <Td className="font-medium text-zinc-900">{applicantLabel(application)}</Td>
                  {jobsForFilter ? (
                    <Td className="text-zinc-600">
                      {jobsById.get(application.job_id)?.title ?? "Deleted job"}
                    </Td>
                  ) : null}
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
          {status ? (
            <p className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500">
              Showing {items.length} {status} of {data.items.length} loaded.
            </p>
          ) : (
            <Pagination
              total={data.total}
              limit={limit}
              offset={offset}
              buildHref={(nextOffset) => buildHref({ offset: nextOffset })}
            />
          )}
        </>
      )}

      <ApplicationDrawer
        application={open}
        questions={openJob?.questions as JobQuestion[] | undefined}
        open={Boolean(open)}
        onOpenChange={(next) => !next && setOpenId(null)}
      />
    </>
  );
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}
