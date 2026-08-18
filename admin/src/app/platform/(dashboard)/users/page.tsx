import { Users } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { Pagination, Table, Td, Th, Tr } from "@/components/ui/table";
import { listPlatformUsers } from "@/lib/api/platform-queries";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 50;

export default async function PlatformUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const { offset: offsetParam } = await searchParams;
  const offset = Number(offsetParam ?? 0) || 0;
  const page = await listPlatformUsers({ limit: PAGE_SIZE, offset });

  return (
    <>
      <PageHeader title="Users" description={`${page.total} accounts across every tenant`} />

      <Card>
        {page.items.length === 0 ? (
          <EmptyState icon={<Users className="size-6" />} title="No users yet" body="Accounts appear here as soon as someone signs up." />
        ) : (
          <>
            <Table caption="Users">
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Company</Th>
                  <Th>Role</Th>
                  <Th>Verified</Th>
                  <Th className="text-right">Created</Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((user) => (
                  <Tr key={user.id}>
                    <Td className="font-medium text-zinc-900">{user.email}</Td>
                    <Td className="text-zinc-600">{user.tenant_name}</Td>
                    <Td className="capitalize text-zinc-600">{user.role}</Td>
                    <Td>
                      <Badge tone={user.email_verified ? "success" : "neutral"}>
                        {user.email_verified ? "Verified" : "Unverified"}
                      </Badge>
                    </Td>
                    <Td className="text-right text-xs text-zinc-500">{formatDate(user.created_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              total={page.total}
              limit={PAGE_SIZE}
              offset={offset}
              buildHref={(nextOffset) => `/platform/users?offset=${nextOffset}`}
            />
          </>
        )}
      </Card>
    </>
  );
}
