import type { Metadata } from "next";

import { Card, CardBody, CardHeader, Callout, PageHeader } from "@/components/ui/surface";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/api/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Team" };

export default async function TeamSettingsPage() {
  const user = await getCurrentUser();

  return (
    <>
      <PageHeader title="Team" description="Who has access to this workspace." />

      <Card className="mb-5">
        <Table caption="Team members">
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            <Tr>
              <Td className="font-medium text-zinc-900">{user.email}</Td>
              <Td className="capitalize text-zinc-600">{user.role}</Td>
              <Td className="text-zinc-600">{formatDate(user.created_at)}</Td>
            </Tr>
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader title="Inviting teammates" />
        <CardBody>
          <Callout tone="neutral">
            Multi-seat invites aren&rsquo;t available yet — v0.1 ships with a single admin per
            workspace (backend spec §13). Everyone on your team can share this login until invites
            land.
          </Callout>
        </CardBody>
      </Card>
    </>
  );
}
