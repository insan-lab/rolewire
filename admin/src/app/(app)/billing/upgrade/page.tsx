import type { Metadata } from "next";
import Link from "next/link";

import { BillingUpgrade } from "@/components/app/billing-upgrade";
import { PageHeader } from "@/components/ui/surface";
import { getBillingOverview, listPlans } from "@/lib/api/queries";

export const metadata: Metadata = { title: "Upgrade" };

export default async function BillingUpgradePage() {
  const [plans, billing] = await Promise.all([listPlans(), getBillingOverview().catch(() => null)]);

  return (
    <>
      <PageHeader
        title="Choose a plan"
        description="Prices shown match the checkout you'll complete — Paddle globally, UddoktaPay in Bangladesh."
        breadcrumb={
          <Link href="/billing" className="text-xs text-zinc-500 hover:text-zinc-800">
            ← Back to billing
          </Link>
        }
      />
      <BillingUpgrade plans={plans} region={billing?.region ?? null} currentPlanId={billing?.plan?.id} />
    </>
  );
}
