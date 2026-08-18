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
    <Element
      className={cn("rounded-lg border shadow-card", className)}
      style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
    >
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
        "flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3",
        className,
      )}
      style={{ borderColor: "var(--line-soft)" }}
    >
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold text-paper">{title}</h2>
        {description ? <p className="text-xs text-dim">{description}</p> : null}
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
        <h1 className="truncate font-display text-lg font-semibold tracking-tight text-paper">
          {title}
        </h1>
        {description ? <p className="max-w-2xl text-sm text-dim">{description}</p> : null}
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
      {icon ? <div className="mb-1 text-dim">{icon}</div> : null}
      <p className="text-sm font-medium text-paper">{title}</p>
      <p className="max-w-md text-sm text-dim">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

const CALLOUT_TONES = {
  neutral: { border: "var(--line-soft)", bg: "var(--ink-soft)", text: "var(--text-dim)" },
  info: { border: "var(--copper)", bg: "rgba(192,122,62,0.08)", text: "var(--copper-bright)" },
  warning: { border: "#92400e55", bg: "rgba(146,64,14,0.08)", text: "#fbbf24" },
  danger: { border: "#991b1b55", bg: "rgba(153,27,27,0.08)", text: "#f87171" },
  success: { border: "var(--signal)", bg: "rgba(127,174,122,0.08)", text: "var(--signal)" },
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
  const t = CALLOUT_TONES[tone];
  return (
    <div
      className={cn("rounded-md border px-3 py-2.5 text-sm", className)}
      style={{ borderColor: t.border, background: t.bg, color: t.text }}
    >
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
      <p className="font-mono text-xs font-medium uppercase tracking-wide text-dim">{label}</p>
      <p className="text-2xl font-semibold tracking-tight text-paper">{value}</p>
      {hint ? <p className="text-xs text-dim">{hint}</p> : null}
    </div>
  );
}
