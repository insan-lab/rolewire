import type { Metadata } from "next";

import { ApplicationsInbox } from "@/components/app/applications-inbox";
import { Card, PageHeader } from "@/components/ui/surface";
import { listApplications, listJobs } from "@/lib/api/queries";

export const metadata: Metadata = { title: "Applications" };

const PAGE_SIZE = 25;

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; job?: string; offset?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "";
  const jobId = params.job ?? "";
  const offset = Number(params.offset ?? 0) || 0;

  const [page, jobs] = await Promise.all([
    listApplications({
      jobId: jobId || undefined,
      limit: status ? 100 : PAGE_SIZE,
      offset: status ? 0 : offset,
    }),
    listJobs({ limit: 100 }),
  ]);

  return (
    <>
      <PageHeader
        title="Applications"
        description="Every submission across every job in this workspace. Updates automatically as new ones arrive."
      />
      <ApplicationsInbox
        initialPage={page}
        basePath="/applications"
        jobId={jobId || undefined}
        status={status}
        offset={offset}
        limit={status ? 100 : PAGE_SIZE}
        jobsForFilter={jobs.items}
      />
    </>
  );
}
