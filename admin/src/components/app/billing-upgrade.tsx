"use client";

import Script from "next/script";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { startUpgradeAction } from "@/lib/actions";
import type { Plan } from "@/lib/api/types";
import { PADDLE_CLIENT_TOKEN, PADDLE_ENVIRONMENT } from "@/lib/env";
import { cn, formatMoney } from "@/lib/utils";

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: string) => void };
      Initialize: (options: { token: string }) => void;
      Checkout: { open: (options: Record<string, unknown>) => void };
    };
  }
}

type Cycle = "monthly" | "yearly";

/**
 * The upgrade endpoint returns Paddle checkout parameters embedded in a human-readable `note`
 * (backend §9.3 leaves the price id there rather than as a structured field) — parsed out here
 * rather than reshaping the backend response.
 */
function parsePaddleNote(note: string | null | undefined): { priceId: string; tenantId: string } | null {
  const priceId = note?.match(/price_id=(\S+?)(?:\s|$)/)?.[1];
  const tenantId = note?.match(/tenant_id=([0-9a-fA-F-]{36})/)?.[1];
  return priceId && tenantId ? { priceId, tenantId } : null;
}

export function BillingUpgrade({
  plans,
  region,
  currentPlanId,
}: {
  plans: Plan[];
  region: string | null;
  currentPlanId?: string;
}) {
  const toast = useToast();
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [paddleReady, setPaddleReady] = useState(false);

  const isBd = region === "BD";
  const provider: "paddle" | "uddoktapay" = isBd ? "uddoktapay" : "paddle";

  function initPaddle() {
    if (!window.Paddle || !PADDLE_CLIENT_TOKEN) return;
    window.Paddle.Environment.set(PADDLE_ENVIRONMENT);
    window.Paddle.Initialize({ token: PADDLE_CLIENT_TOKEN });
    setPaddleReady(true);
  }

  async function upgrade(plan: Plan) {
    setPendingPlanId(plan.id);
    const result = await startUpgradeAction({ plan_id: plan.id, billing_cycle: cycle, provider });
    setPendingPlanId(null);

    if (!result.ok) {
      toast.error("Couldn't start checkout", result.error);
      return;
    }

    if (provider === "uddoktapay") {
      if (!result.data.checkout_url) {
        toast.error("Checkout unavailable", "UddoktaPay didn't return a payment link.");
        return;
      }
      window.location.assign(result.data.checkout_url);
      return;
    }

    const parsed = parsePaddleNote(result.data.note);
    if (!window.Paddle || !parsed) {
      toast.error(
        "Checkout unavailable",
        !PADDLE_CLIENT_TOKEN
          ? "Paddle isn't configured on this deployment yet."
          : "Couldn't open Paddle checkout. Try again in a moment.",
      );
      return;
    }
    window.Paddle.Checkout.open({
      items: [{ priceId: parsed.priceId, quantity: 1 }],
      customData: { tenant_id: parsed.tenantId },
    });
  }

  return (
    <div className="space-y-5">
      {!isBd ? (
        <Script
          src="https://cdn.paddle.com/paddle/v2/paddle.js"
          strategy="afterInteractive"
          onLoad={initPaddle}
        />
      ) : null}

      <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-1 text-sm">
        {(["monthly", "yearly"] as Cycle[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCycle(option)}
            className={cn(
              "rounded px-3 py-1 font-medium capitalize",
              cycle === option ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100",
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => {
          const price = isBd
            ? cycle === "monthly"
              ? plan.monthly_price_bdt
              : plan.yearly_price_bdt
            : cycle === "monthly"
              ? plan.monthly_price_usd
              : plan.yearly_price_usd;
          const isCurrent = plan.id === currentPlanId;

          return (
            <Card key={plan.id} className={cn(isCurrent && "border-accent-400 ring-1 ring-accent-200")}>
              <CardHeader
                title={<span className="capitalize">{plan.name}</span>}
                description={`${formatMoney(price, isBd ? "BDT" : "USD")} / ${cycle === "monthly" ? "mo" : "yr"}`}
              />
              <CardBody className="space-y-4">
                <ul className="space-y-1.5 text-sm text-zinc-700">
                  {Object.entries(plan.features).map(([key, value]) =>
                    value === true || typeof value === "number" ? (
                      <li key={key}>{featureLabel(key, value)}</li>
                    ) : null,
                  )}
                </ul>
                <Button
                  type="button"
                  className="w-full"
                  variant={isCurrent ? "secondary" : "primary"}
                  disabled={isCurrent || (provider === "paddle" && !paddleReady && Boolean(PADDLE_CLIENT_TOKEN))}
                  loading={pendingPlanId === plan.id}
                  onClick={() => upgrade(plan)}
                >
                  {isCurrent ? "Current plan" : "Choose this plan"}
                </Button>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-zinc-500">
        {isBd
          ? "Paying with bKash or Nagad via UddoktaPay. Renewals are charged manually each cycle."
          : "Card and PayPal via Paddle, which handles VAT/GST as merchant of record."}
      </p>
    </div>
  );
}

function featureLabel(key: string, value: boolean | number): string {
  const labels: Record<string, string> = {
    email_sending: "Applicant email sending",
    opencats_included: "Hosted OpenCATS",
    own_storage: "Bring your own storage",
    ats_webhook: "ATS webhook forwarding",
    hosted_storage_gb_included: `${value} GB hosted storage included`,
  };
  return labels[key] ?? `${key}: ${value}`;
}
