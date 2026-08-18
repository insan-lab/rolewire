import { Users } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { CopyableId } from "@/components/ui/copyable-id";
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
                  <Th>Email & User ID</Th>
                  <Th>Company & ID</Th>
                  <Th>Role</Th>
                  <Th>Verified</Th>
                  <Th className="text-right">Created</Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((user) => (
                  <Tr key={user.id}>
                    <Td>
                      <p className="font-medium text-paper">{user.email}</p>
                      <CopyableId id={user.id} label="User ID" />
                    </Td>
                    <Td>
                      <p className="text-dim">{user.tenant_name}</p>
                      <CopyableId id={user.tenant_id} label="Company ID" />
                    </Td>
                    <Td className="capitalize text-dim">{user.role}</Td>
                    <Td>
                      <Badge tone={user.email_verified ? "success" : "neutral"}>
                        {user.email_verified ? "Verified" : "Unverified"}
                      </Badge>
                    </Td>
                    <Td className="text-right text-xs text-dim">{formatDate(user.created_at)}</Td>
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
