import { Building2 } from "lucide-react";
import type { Metadata } from "next";

import { TenantStatusBadge } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { Pagination, Table, Td, Th, Tr } from "@/components/ui/table";
import { listPlatformCompanies } from "@/lib/api/platform-queries";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Companies" };

const PAGE_SIZE = 50;

export default async function PlatformCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const { offset: offsetParam } = await searchParams;
  const offset = Number(offsetParam ?? 0) || 0;
  const page = await listPlatformCompanies({ limit: PAGE_SIZE, offset });

  return (
    <>
      <PageHeader title="Companies" description={`${page.total} tenants on Rolewire`} />

      <Card>
        {page.items.length === 0 ? (
          <EmptyState icon={<Building2 className="size-6" />} title="No companies yet" body="Tenants appear here as soon as someone signs up." />
        ) : (
          <>
            <Table caption="Companies">
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th>Status</Th>
                  <Th>Plan</Th>
                  <Th>Region</Th>
                  <Th className="text-right">Users</Th>
                  <Th className="text-right">Jobs</Th>
                  <Th className="text-right">Created</Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((company) => (
                  <Tr key={company.id}>
                    <Td>
                      <p className="font-medium text-zinc-900">{company.name}</p>
                      <p className="text-xs text-zinc-500">{company.slug}</p>
                    </Td>
                    <Td>
                      <TenantStatusBadge status={company.status} />
                    </Td>
                    <Td className="capitalize text-zinc-600">{company.plan_name ?? "—"}</Td>
                    <Td className="text-zinc-600">{company.region ?? "—"}</Td>
                    <Td className="text-right text-zinc-600">{company.user_count}</Td>
                    <Td className="text-right text-zinc-600">{company.job_count}</Td>
                    <Td className="text-right text-xs text-zinc-500">{formatDate(company.created_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              total={page.total}
              limit={PAGE_SIZE}
              offset={offset}
              buildHref={(nextOffset) => `/platform/companies?offset=${nextOffset}`}
            />
          </>
        )}
      </Card>
    </>
  );
}
