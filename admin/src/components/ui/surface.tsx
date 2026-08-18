import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  as: Element = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "li";
}) {
  return (
    <Element className={cn("rounded-lg border border-zinc-200 bg-white shadow-card", className)}>
      {children}
    </Element>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3",
        className,
      )}
    >
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {description ? <p className="text-xs text-zinc-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-3", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        {breadcrumb}
        <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-zinc-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/**
 * Empty states say what will happen next rather than "No data" (frontend spec §7).
 */
export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="mb-1 text-zinc-400">{icon}</div> : null}
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      <p className="max-w-md text-sm text-zinc-500">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

const CALLOUT_TONES = {
  neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
  info: "border-accent-200 bg-accent-50 text-accent-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
} as const;

export function Callout({
  tone = "neutral",
  title,
  children,
  className,
}: {
  tone?: keyof typeof CALLOUT_TONES;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border px-3 py-2.5 text-sm", CALLOUT_TONES[tone], className)}>
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1 text-[0.8125rem] opacity-90")}>{children}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="space-y-1 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
