import { Briefcase } from "lucide-react";
import type { Metadata } from "next";

import { JobStatusSelect } from "@/components/platform/job-status-select";
import { CopyableId } from "@/components/ui/copyable-id";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { Pagination, Table, Td, Th, Tr } from "@/components/ui/table";
import { listPlatformJobs } from "@/lib/api/platform-queries";
import type { JobStatus } from "@/lib/api/types";
import { formatDate, pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Jobs" };

const PAGE_SIZE = 50;

export default async function PlatformJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const { offset: offsetParam } = await searchParams;
  const offset = Number(offsetParam ?? 0) || 0;
  const page = await listPlatformJobs({ limit: PAGE_SIZE, offset });

  return (
    <>
      <PageHeader title="Jobs" description={`${page.total} job posts across every tenant`} />

      <Card>
        {page.items.length === 0 ? (
          <EmptyState icon={<Briefcase className="size-6" />} title="No jobs yet" body="Job posts appear here as soon as a tenant creates one." />
        ) : (
          <>
            <Table caption="Jobs">
              <thead>
                <tr>
                  <Th>Title & Job ID</Th>
                  <Th>Company & ID</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Applications</Th>
                  <Th className="text-right">Created</Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((job) => (
                  <Tr key={job.id}>
                    <Td>
                      <p className="font-medium text-paper">{job.title}</p>
                      <CopyableId id={job.id} label="Job ID" />
                    </Td>
                    <Td>
                      <p className="text-dim">{job.tenant_name}</p>
                      <CopyableId id={job.tenant_id} label="Company ID" />
                    </Td>
                    <Td>
                      <JobStatusSelect jobId={job.id} currentStatus={job.status} />
                    </Td>
                    <Td className="text-right text-dim">
                      {pluralize(job.application_count, "application")}
                    </Td>
                    <Td className="text-right text-xs text-dim">{formatDate(job.created_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              total={page.total}
              limit={PAGE_SIZE}
              offset={offset}
              buildHref={(nextOffset) => `/platform/jobs?offset=${nextOffset}`}
            />
          </>
        )}
      </Card>
    </>
  );
}
