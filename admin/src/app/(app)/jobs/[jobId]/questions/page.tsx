import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuestionsEditor } from "@/components/app/questions-editor";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { ApiError } from "@/lib/api/errors";
import { getJob } from "@/lib/api/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jobId: string }>;
}): Promise<Metadata> {
  const { jobId } = await params;
  try {
    const job = await getJob(jobId);
    return { title: `Questions · ${job.title}` };
  } catch {
    return { title: "Questions" };
  }
}

export default async function JobQuestionsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  let job;
  try {
    job = await getJob(jobId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <PageHeader
        title={`Questions · ${job.title}`}
        breadcrumb={
          <Link href={`/jobs/${job.id}`} className="text-xs text-zinc-500 hover:text-zinc-800">
            ← Back to {job.title}
          </Link>
        }
      />
      <Card>
        <CardHeader
          title="Application questions"
          description="Field keys are what your career page posts back. Drag to reorder. Saving replaces the full question set."
        />
        <CardBody>
          <QuestionsEditor jobId={job.id} initialQuestions={job.questions} />
        </CardBody>
      </Card>
    </>
  );
}
