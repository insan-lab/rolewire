import { Tag } from "lucide-react";
import type { Metadata } from "next";

import { PlanPaddlePanel } from "@/components/platform/plan-paddle-panel";
import { CopyableId } from "@/components/ui/copyable-id";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/surface";
import { listPlatformPlans } from "@/lib/api/platform-queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Plans" };

export default async function PlatformPlansPage() {
  const plans = await listPlatformPlans();

  return (
    <>
      <PageHeader
        title="Plans"
        description="Sync each plan to Paddle to create its product and prices. Until a plan is synced, checkout returns 503 for that plan."
      />

      {plans.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Tag className="size-6" />}
            title="No plans yet"
            body="Run `python -m app.cli seed-plans` to create the default tiers."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader
                title={<span className="capitalize">{plan.name}</span>}
                description={
                  <>
                    {formatMoney(plan.monthly_price_usd, "USD")}/mo ·{" "}
                    {formatMoney(plan.yearly_price_usd, "USD")}/yr
                  </>
                }
                actions={<CopyableId id={plan.id} label="Plan ID" />}
              />
              <CardBody>
                <PlanPaddlePanel plan={plan} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
