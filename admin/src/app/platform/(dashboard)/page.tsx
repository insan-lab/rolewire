import type { Metadata } from "next";

import { Card, CardBody, CardHeader, PageHeader, Stat } from "@/components/ui/surface";
import { getPlatformStats } from "@/lib/api/platform-queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Platform overview" };

export default async function PlatformOverviewPage() {
  const stats = await getPlatformStats();
  const revenueEntries = Object.entries(stats.revenue_paid_total);

  return (
    <>
      <PageHeader title="Platform overview" description="Every tenant, at a glance." />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat
            label="Companies"
            value={stats.tenants_total}
            hint={`${stats.tenants_active} active`}
          />
        </Card>
        <Card>
          <Stat label="Users" value={stats.users_total} />
        </Card>
        <Card>
          <Stat
            label="Jobs"
            value={stats.jobs_total}
            hint={`${stats.jobs_published} published`}
          />
        </Card>
        <Card>
          <Stat label="Applications" value={stats.applications_total} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Subscriptions" description="Active, across every tenant" />
          <CardBody>
            <p className="text-2xl font-semibold tracking-tight text-paper">
              {stats.subscriptions_active}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Revenue" description="Paid invoices, all time" />
          <CardBody>
            {revenueEntries.length === 0 ? (
              <p className="text-sm text-dim">No paid invoices yet.</p>
            ) : (
              <dl className="space-y-1.5">
                {revenueEntries.map(([currency, amount]) => (
                  <div key={currency} className="flex items-baseline justify-between">
                    <dt className="font-mono text-xs text-dim">{currency}</dt>
                    <dd className="text-sm font-medium text-paper">
                      {formatMoney(amount, currency)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
