import { cn } from "@/lib/utils";

/**
 * Usage bar for the billing page (frontend spec §6.4): a plain progress meter, not a chart.
 * `max` of 0 means "no metered quota", in which case only the raw value is meaningful.
 */
export function Progress({
  value,
  max,
  label,
  valueLabel,
  className,
}: {
  value: number;
  max: number;
  label: string;
  valueLabel?: string;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const percent = Math.round(ratio * 100);
  const overQuota = max > 0 && value > max;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-zinc-700">{label}</span>
        <span className={cn("text-xs", overQuota ? "font-medium text-amber-700" : "text-zinc-500")}>
          {valueLabel}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={max > 0 ? percent : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200"
      >
        <div
          className={cn("h-full rounded-full", overQuota ? "bg-amber-500" : "bg-accent-500")}
          style={{ width: `${max > 0 ? percent : 0}%` }}
        />
      </div>
    </div>
  );
}
