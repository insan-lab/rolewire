import type { Metadata } from "next";

import { TenantStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardBody, CardHeader, Callout, EmptyState, PageHeader } from "@/components/ui/surface";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { getBillingOverview } from "@/lib/api/queries";
import { formatBytesFromMb, formatDate, formatMoney, pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const billing = await getBillingOverview();

  const storageMb = Number(billing.usage.storage_mb ?? 0);
  const applications = Number(billing.usage.application_received ?? 0);
  const includedGb = Number(billing.plan?.features.hosted_storage_gb_included ?? 0);

  return (
    <>
      <PageHeader
        title="Billing"
        description="Current plan, usage this cycle, and invoice history."
        actions={
          <LinkButton href="/billing/upgrade" size="sm">
            {billing.plan ? "Change plan" : "Choose a plan"}
          </LinkButton>
        }
      />

      {status === "success" ? (
        <Callout tone="success" className="mb-5">
          Payment received. It can take a minute for your plan to update here.
        </Callout>
      ) : status === "cancelled" ? (
        <Callout tone="neutral" className="mb-5">
          Checkout was cancelled — nothing was charged.
        </Callout>
      ) : null}

      {billing.tenant_status === "past_due" ? (
        <Callout tone="warning" className="mb-5" title="Payment past due">
          Your last renewal didn&rsquo;t go through. Update billing before the grace period ends to
          avoid your public endpoints being suspended.
        </Callout>
      ) : null}
      {billing.tenant_status === "suspended" ? (
        <Callout tone="danger" className="mb-5" title="Workspace suspended">
          Public endpoints are returning 410 Gone until this is resolved.
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Usage this cycle" />
            <CardBody className="space-y-4">
              <Progress
                label="Hosted storage"
                value={storageMb}
                max={includedGb * 1024}
                valueLabel={
                  includedGb > 0
                    ? `${formatBytesFromMb(storageMb)} of ${includedGb} GB`
                    : formatBytesFromMb(storageMb)
                }
              />
              <Progress
                label="Applications received"
                value={applications}
                max={0}
                valueLabel={pluralize(applications, "application")}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Invoices" />
            {billing.invoices.length === 0 ? (
              <EmptyState title="No invoices yet" body="Invoices from Paddle or UddoktaPay appear here as they're issued." />
            ) : (
              <Table caption="Invoice history">
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Provider</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {billing.invoices.map((invoice) => (
                    <Tr key={invoice.id}>
                      <Td className="text-zinc-600">{formatDate(invoice.created_at)}</Td>
                      <Td className="capitalize text-zinc-600">{invoice.provider}</Td>
                      <Td className="capitalize text-zinc-600">{invoice.status}</Td>
                      <Td className="text-right font-medium text-zinc-900">
                        {formatMoney(invoice.amount, invoice.currency)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Plan" actions={<TenantStatusBadge status={billing.tenant_status} />} />
          <CardBody className="space-y-3 text-sm">
            <div>
              <p className="font-medium capitalize text-zinc-900">{billing.plan?.name ?? "No plan yet"}</p>
              <p className="text-xs text-zinc-500">
                {billing.subscription
                  ? `${billing.subscription.billing_cycle} · ${billing.subscription.status}`
                  : "No active subscription"}
              </p>
            </div>
            {billing.subscription?.current_period_end ? (
              <p className="text-xs text-zinc-500">
                Renews {formatDate(billing.subscription.current_period_end)}
              </p>
            ) : null}
            <p className="text-xs text-zinc-500">
              {billing.payment_provider
                ? `Billed through ${billing.payment_provider}`
                : "No payment method connected"}
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
