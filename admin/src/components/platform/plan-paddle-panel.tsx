"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CopyableId } from "@/components/ui/copyable-id";
import { Field, Input } from "@/components/ui/field";
import type { PlatformPlan } from "@/lib/api/types";

/**
 * Paddle catalog controls for one plan. Price IDs are no longer typed by hand — they come from
 * "Sync to Paddle" (creates the product + both prices) and "Change price" (creates replacement
 * prices via /reprice). Both are create-only; existing IDs are shown read-only.
 */
export function PlanPaddlePanel({ plan }: { plan: PlatformPlan }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "sync" | "reprice">(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repricing, setRepricing] = useState(false);
  const [monthly, setMonthly] = useState(plan.monthly_price_usd ?? "");
  const [yearly, setYearly] = useState(plan.yearly_price_usd ?? "");

  const synced = plan.paddle_product_id !== null;

  async function post(path: string, body?: unknown, kind: "sync" | "reprice" = "sync") {
    setBusy(kind);
    setError(null);
    setDone(false);
    try {
      const res = await fetch(`/api/platform-backend/v1/admin/platform/plans/${plan.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        // Surface Paddle's own error detail verbatim — it is usually specific and actionable.
        throw new Error(payload?.detail ?? `Request failed (HTTP ${res.status})`);
      }
      setDone(true);
      setRepricing(false);
      setTimeout(() => setDone(false), 2500);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function handleReprice() {
    const m = monthly.trim();
    const y = yearly.trim();
    if (!(Number(m) > 0) || !(Number(y) > 0)) {
      setError("Enter positive monthly and yearly USD amounts.");
      return;
    }
    const ok = window.confirm(
      `Create new Paddle prices at $${m}/mo and $${y}/yr for "${plan.name}".\n\n` +
        "Existing subscribers keep their CURRENT price until they re-subscribe or upgrade — " +
        "this does not migrate anyone. The old price IDs are kept for reporting.\n\nContinue?",
    );
    if (!ok) return;
    void post("reprice", { new_monthly_price_usd: m, new_yearly_price_usd: y }, "reprice");
  }

  return (
    <div className="space-y-3">
      {!synced ? (
        <>
          <p className="text-xs text-dim">
            Not in Paddle yet. Sync creates one product and two prices matching{" "}
            <span className="text-paper">${plan.monthly_price_usd ?? "—"}/mo</span> and{" "}
            <span className="text-paper">${plan.yearly_price_usd ?? "—"}/yr</span>.
          </p>
          <Button size="sm" loading={busy === "sync"} onClick={() => void post("sync-paddle")}>
            Sync to Paddle
          </Button>
        </>
      ) : (
        <>
          <dl className="grid gap-1.5 text-xs sm:grid-cols-[9rem_1fr]">
            <dt className="text-dim">Product ID</dt>
            <dd>
              <CopyableId id={plan.paddle_product_id!} label="Product ID" truncate />
            </dd>
            <dt className="text-dim">Monthly price ID</dt>
            <dd>
              {plan.paddle_monthly_price_id ? (
                <CopyableId id={plan.paddle_monthly_price_id} label="Monthly price ID" truncate />
              ) : (
                <span className="text-dim">—</span>
              )}
            </dd>
            <dt className="text-dim">Yearly price ID</dt>
            <dd>
              {plan.paddle_yearly_price_id ? (
                <CopyableId id={plan.paddle_yearly_price_id} label="Yearly price ID" truncate />
              ) : (
                <span className="text-dim">—</span>
              )}
            </dd>
            {(plan.paddle_monthly_price_id_previous ?? plan.paddle_yearly_price_id_previous) && (
              <>
                <dt className="text-dim">Previous IDs</dt>
                <dd className="space-y-1 text-dim">
                  {plan.paddle_monthly_price_id_previous && (
                    <div>
                      <CopyableId
                        id={plan.paddle_monthly_price_id_previous}
                        label="Previous monthly price ID"
                        truncate
                      />{" "}
                      <span className="text-[0.7rem]">(subscribers still on this)</span>
                    </div>
                  )}
                  {plan.paddle_yearly_price_id_previous && (
                    <div>
                      <CopyableId
                        id={plan.paddle_yearly_price_id_previous}
                        label="Previous yearly price ID"
                        truncate
                      />{" "}
                      <span className="text-[0.7rem]">(subscribers still on this)</span>
                    </div>
                  )}
                </dd>
              </>
            )}
          </dl>

          {repricing ? (
            <div className="grid gap-3 rounded-md border border-[var(--line-soft)] p-3 sm:grid-cols-2">
              <Field label="New monthly USD" htmlFor={`${plan.id}-rm`}>
                <Input
                  id={`${plan.id}-rm`}
                  inputMode="decimal"
                  value={monthly}
                  onChange={(e) => setMonthly(e.target.value)}
                />
              </Field>
              <Field label="New yearly USD" htmlFor={`${plan.id}-ry`}>
                <Input
                  id={`${plan.id}-ry`}
                  inputMode="decimal"
                  value={yearly}
                  onChange={(e) => setYearly(e.target.value)}
                />
              </Field>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Button size="sm" loading={busy === "reprice"} onClick={handleReprice}>
                  Create new prices
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRepricing(false);
                    setError(null);
                    setMonthly(plan.monthly_price_usd ?? "");
                    setYearly(plan.yearly_price_usd ?? "");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setRepricing(true)}>
              Change price
            </Button>
          )}
        </>
      )}

      {busy && <Loader2 className="inline size-3.5 animate-spin text-copper-bright" />}
      {done && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
          <Check className="size-3.5" /> Done
        </span>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
