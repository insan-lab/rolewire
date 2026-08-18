import { Plug } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { JobStatusBadge } from "@/components/ui/badge";
import { Card, Callout, EmptyState, PageHeader } from "@/components/ui/surface";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { listJobs } from "@/lib/api/queries";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsSettingsPage() {
  const jobs = await listJobs({ limit: 100 });

  return (
    <>
      <PageHeader
        title="Integrations"
        description="ATS webhook forwarding and hosted OpenCATS sync are configured per job, not per workspace."
      />

      <Callout tone="info" className="mb-5">
        Each job carries its own <code className="font-mono text-xs">ats_webhook_url</code> and
        OpenCATS toggle, since jobs can forward to different systems. Open a job to change either —
        there&rsquo;s nothing to set here. Hosted OpenCATS provisioning isn&rsquo;t available yet
        (backend spec §7), so the toggle has no effect until it ships.
      </Callout>

      <Card>
        {jobs.items.length === 0 ? (
          <EmptyState
            icon={<Plug className="size-6" />}
            title="No jobs yet"
            body="Create a job first, then set its ATS webhook or OpenCATS sync from its detail page."
          />
        ) : (
          <Table caption="ATS forwarding per job">
            <thead>
              <tr>
                <Th>Job</Th>
                <Th>Status</Th>
                <Th>ATS webhook</Th>
                <Th>OpenCATS sync</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.items.map((job) => (
                <Tr key={job.id}>
                  <Td>
                    <Link href={`/jobs/${job.id}`} className="font-medium text-paper hover:text-copper-bright hover:underline">
                      {job.title}
                    </Link>
                  </Td>
                  <Td>
                    <JobStatusBadge status={job.status} />
                  </Td>
                  <Td className="max-w-xs truncate font-mono text-xs text-dim">
                    {job.ats_webhook_url ?? "Not set"}
                  </Td>
                  <Td className="text-dim">{job.opencats_sync ? "On" : "Off"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
