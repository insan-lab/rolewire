import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { Pagination, Table, Th } from "@/components/ui/table";
import { ContactSubmissionRow } from "@/components/platform/contact-submission-row";
import { listPlatformContactSubmissions } from "@/lib/api/platform-queries";
import type { ContactSubmissionStatus } from "@/lib/api/types";

export const metadata: Metadata = { title: "Contact Submissions" };

const PAGE_SIZE = 50;

const STATUS_FILTERS: { label: string; value?: ContactSubmissionStatus }[] = [
  { label: "All" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Ignored", value: "ignored" },
];

export default async function PlatformContactSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string; status?: string }>;
}) {
  const { offset: offsetParam, status: statusParam } = await searchParams;
  const offset = Number(offsetParam ?? 0) || 0;
  const statusFilter = (STATUS_FILTERS.some((f) => f.value === statusParam)
    ? statusParam
    : undefined) as ContactSubmissionStatus | undefined;

  const page = await listPlatformContactSubmissions({
    limit: PAGE_SIZE,
    offset,
    status: statusFilter,
  });

  return (
    <>
      <PageHeader
        title="Contact Submissions"
        description={`${page.total} public contact form inquiry ${page.total === 1 ? "submission" : "submissions"}`}
      />

      <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((filter) => {
          const isActive = statusFilter === filter.value;
          const href = filter.value
            ? `/platform/contact?status=${filter.value}`
            : "/platform/contact";

          return (
            <Link
              key={filter.label}
              href={href}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-copper-bright text-white"
                  : "bg-[var(--ink-soft)] text-dim hover:text-paper"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <Card>
        {page.items.length === 0 ? (
          <EmptyState
            icon={<Mail className="size-6" />}
            title="No contact submissions"
            body={
              statusFilter
                ? `No submissions found with status '${statusFilter}'.`
                : "Messages sent via the public contact form will appear here."
            }
          />
        ) : (
          <>
            <Table caption="Contact Submissions">
              <thead>
                <tr>
                  <Th>UUID</Th>
                  <Th>Sender</Th>
                  <Th>Message</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Date</Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((sub) => (
                  <ContactSubmissionRow key={sub.id} submission={sub} />
                ))}
              </tbody>
            </Table>
            <Pagination
              total={page.total}
              limit={PAGE_SIZE}
              offset={offset}
              buildHref={(nextOffset) =>
                `/platform/contact?offset=${nextOffset}${
                  statusFilter ? `&status=${statusFilter}` : ""
                }`
              }
            />
          </>
        )}
      </Card>
    </>
  );
}
