import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobEditor } from "@/components/app/job-editor";
import { JobStatusBadge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { Card, CardHeader, Callout, PageHeader } from "@/components/ui/surface";
import { ApiError } from "@/lib/api/errors";
import { getJob, getPublicJob, listStorageConfigs } from "@/lib/api/queries";
import { pluralize } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jobId: string }>;
}): Promise<Metadata> {
  const { jobId } = await params;
  try {
    const job = await getJob(jobId);
    return { title: job.title };
  } catch {
    return { title: "Job" };
  }
}

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  let job;
  try {
    job = await getJob(jobId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const [storageConfigs, publicJob] = await Promise.all([
    listStorageConfigs().catch(() => []),
    job.status === "published" ? getPublicJob(job.id) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title={job.title}
        description={pluralize(job.questions.length, "question")}
        actions={<JobStatusBadge status={job.status} />}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <JobEditor job={job} storageConfigs={storageConfigs} />

        <Card className="h-fit">
          <CardHeader
            title="Public API preview"
            description={`GET /v1/public/jobs/${job.id}`}
          />
          <div className="p-3">
            {publicJob ? (
              <CodeBlock code={JSON.stringify(publicJob, null, 2)} label="live response" />
            ) : job.status === "published" ? (
              <Callout tone="warning">
                This job is published but the public endpoint didn&rsquo;t return it — the API may be
                unreachable right now.
              </Callout>
            ) : (
              <Callout tone="neutral">
                Publish this job to see the exact response your career page will receive.
              </Callout>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
