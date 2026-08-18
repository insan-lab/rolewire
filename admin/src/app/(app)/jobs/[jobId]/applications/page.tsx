import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApplicationsInbox } from "@/components/app/applications-inbox";
import { Card, PageHeader } from "@/components/ui/surface";
import { ApiError } from "@/lib/api/errors";
import { getJob, listApplications } from "@/lib/api/queries";

const PAGE_SIZE = 25;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jobId: string }>;
}): Promise<Metadata> {
  const { jobId } = await params;
  try {
    const job = await getJob(jobId);
    return { title: `Applications · ${job.title}` };
  } catch {
    return { title: "Applications" };
  }
}

export default async function JobApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ status?: string; offset?: string }>;
}) {
  const { jobId } = await params;
  const { status = "", offset: offsetParam } = await searchParams;
  const offset = Number(offsetParam ?? 0) || 0;

  let job;
  try {
    job = await getJob(jobId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const page = await listApplications({
    jobId,
    limit: status ? 100 : PAGE_SIZE,
    offset: status ? 0 : offset,
  });

  return (
    <>
      <PageHeader
        title={`Applications · ${job.title}`}
        breadcrumb={
          <Link href={`/jobs/${job.id}`} className="text-xs text-zinc-500 hover:text-zinc-800">
            ← Back to {job.title}
          </Link>
        }
      />
      <Card>
        <ApplicationsInbox
          initialPage={page}
          basePath={`/jobs/${job.id}/applications`}
          jobId={job.id}
          status={status}
          offset={offset}
          limit={status ? 100 : PAGE_SIZE}
        />
      </Card>
    </>
  );
}
