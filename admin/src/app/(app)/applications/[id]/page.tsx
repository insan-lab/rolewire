import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApplicationStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Callout, PageHeader } from "@/components/ui/surface";
import { ApiError } from "@/lib/api/errors";
import { getApplication, getJob } from "@/lib/api/queries";
import type { Job } from "@/lib/api/types";
import { applicantLabel, formatDateTime } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const application = await getApplication(id);
    return { title: applicantLabel(application) };
  } catch {
    return { title: "Application" };
  }
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let application;
  try {
    application = await getApplication(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // Best-effort: the owning job may since have been deleted (applications outlive it, §5.2).
  let job: Job | null = null;
  try {
    job = await getJob(application.job_id);
  } catch {
    job = null;
  }

  const labelFor = (key: string) => job?.questions.find((q) => q.field_key === key)?.label ?? key;
  const answers = Object.entries(application.answers as Record<string, unknown>);

  return (
    <>
      <PageHeader
        title={applicantLabel(application)}
        description={`Submitted ${formatDateTime(application.created_at)}`}
        breadcrumb={
          job ? (
            <Link
              href={`/jobs/${job.id}/applications`}
              className="text-xs text-zinc-500 hover:text-zinc-800"
            >
              ← Back to {job.title} applications
            </Link>
          ) : (
            <Link href="/applications" className="text-xs text-zinc-500 hover:text-zinc-800">
              ← Back to applications
            </Link>
          )
        }
        actions={<ApplicationStatusBadge status={application.status} />}
      />

      <div className="space-y-5">
        {application.status === "failed" ? (
          <Callout tone="danger" title="Forwarding to the ATS webhook failed">
            Rolewire received and kept this application — only the outbound delivery to the job&rsquo;s
            <code className="mx-1 font-mono text-xs">ats_webhook_url</code>
            did not go through. There is no retry action yet; the receiving ATS should be checked
            directly, or this application forwarded manually.
          </Callout>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
          <Card>
            <CardHeader title="Answers" description={job ? `For ${job.title}` : undefined} />
            <dl className="divide-y divide-zinc-100">
              {answers.map(([key, value]) => (
                <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
                  <dt className="text-xs text-zinc-500">{labelFor(key)}</dt>
                  <dd className="text-sm text-zinc-900">{formatAnswer(value)}</dd>
                </div>
              ))}
              {answers.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-500">
                  This application has no answers on file.
                </p>
              ) : null}
            </dl>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader title="Applicant" />
              <CardBody className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-zinc-500">Email</p>
                  <p className="text-zinc-900">{application.applicant_email ?? "Not provided"}</p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Résumé" />
              <CardBody className="space-y-2">
                {application.resume_ref ? (
                  <code className="block break-all rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs text-zinc-700">
                    {application.resume_ref}
                  </code>
                ) : (
                  <p className="text-sm text-zinc-500">No file was attached.</p>
                )}
                <p className="text-xs text-zinc-500">
                  Points at the file inside{" "}
                  {job ? job.storage_target : "the job's configured storage"}. A direct download link
                  is not available in this panel yet.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "—";
  return String(value);
}
