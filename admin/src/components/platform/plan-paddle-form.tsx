"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

/**
 * Edits a plan's two Paddle price ids (monthly + yearly). Both are submitted every save — a
 * cleared field clears the id server-side (see PlatformPlanUpdate). Replaces the manual
 * `UPDATE plans SET paddle_*_price_id ...` psql step in docs/paddle.md §5.
 */
export function PlanPaddleForm({
  planId,
  monthlyPriceId,
  yearlyPriceId,
}: {
  planId: string;
  monthlyPriceId: string | null;
  yearlyPriceId: string | null;
}) {
  const router = useRouter();
  const [monthly, setMonthly] = useState(monthlyPriceId ?? "");
  const [yearly, setYearly] = useState(yearlyPriceId ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = monthly.trim() !== (monthlyPriceId ?? "") || yearly.trim() !== (yearlyPriceId ?? "");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(`/api/platform-backend/v1/admin/platform/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paddle_monthly_price_id: monthly.trim() || null,
          paddle_yearly_price_id: yearly.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail ?? "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Monthly price ID" htmlFor={`${planId}-monthly`} hint="Paddle price id (pri_…)">
        <Input
          id={`${planId}-monthly`}
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          placeholder="pri_…"
          spellCheck={false}
          autoComplete="off"
        />
      </Field>
      <Field label="Yearly price ID" htmlFor={`${planId}-yearly`} hint="Paddle price id (pri_…)">
        <Input
          id={`${planId}-yearly`}
          value={yearly}
          onChange={(e) => setYearly(e.target.value)}
          placeholder="pri_…"
          spellCheck={false}
          autoComplete="off"
        />
      </Field>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" size="sm" loading={saving} disabled={!dirty}>
          Save
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <Check className="size-3.5" /> Saved
          </span>
        )}
        {saving && <Loader2 className="size-3.5 animate-spin text-copper-bright" />}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </form>
  );
}
