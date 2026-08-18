import { CreditCard } from "lucide-react";
import type { Metadata } from "next";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { CopyableId } from "@/components/ui/copyable-id";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { Pagination, Table, Td, Th, Tr } from "@/components/ui/table";
import { listPlatformBilling } from "@/lib/api/platform-queries";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

const PAGE_SIZE = 50;

const INVOICE_STATUS_TONE: Record<string, BadgeTone> = {
  paid: "success",
  failed: "danger",
  refunded: "neutral",
};

export default async function PlatformBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const { offset: offsetParam } = await searchParams;
  const offset = Number(offsetParam ?? 0) || 0;
  const page = await listPlatformBilling({ limit: PAGE_SIZE, offset });

  return (
    <>
      <PageHeader title="Billing" description={`${page.total} invoices across every tenant`} />

      <Card>
        {page.items.length === 0 ? (
          <EmptyState icon={<CreditCard className="size-6" />} title="No invoices yet" body="Invoices appear here as tenants pay." />
        ) : (
          <>
            <Table caption="Invoices">
              <thead>
                <tr>
                  <Th>Company & ID</Th>
                  <Th>Invoice ID</Th>
                  <Th>Provider</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Date</Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((invoice) => (
                  <Tr key={invoice.id}>
                    <Td>
                      <p className="font-medium text-paper">{invoice.tenant_name}</p>
                      <CopyableId id={invoice.tenant_id} label="Company ID" />
                    </Td>
                    <Td>
                      <CopyableId id={invoice.id} label="Invoice ID" />
                    </Td>
                    <Td className="capitalize text-dim">{invoice.provider}</Td>
                    <Td>
                      <Badge tone={INVOICE_STATUS_TONE[invoice.status] ?? "neutral"}>
                        {invoice.status}
                      </Badge>
                    </Td>
                    <Td className="text-right text-dim">
                      {formatMoney(invoice.amount, invoice.currency)}
                    </Td>
                    <Td className="text-right text-xs text-dim">{formatDate(invoice.created_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              total={page.total}
              limit={PAGE_SIZE}
              offset={offset}
              buildHref={(nextOffset) => `/platform/billing?offset=${nextOffset}`}
            />
          </>
        )}
      </Card>
    </>
  );
}
