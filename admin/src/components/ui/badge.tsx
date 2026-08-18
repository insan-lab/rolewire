import type { ReactNode } from "react";

import type { ApplicationStatus, JobStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  accent: "bg-accent-50 text-accent-700 ring-accent-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const JOB_STATUS: Record<JobStatus, { tone: BadgeTone; label: string }> = {
  draft: { tone: "neutral", label: "Draft" },
  published: { tone: "success", label: "Published" },
  closed: { tone: "warning", label: "Closed" },
};

const JOB_STATUS_FALLBACK = { tone: "neutral" as BadgeTone, label: "Draft" };

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { tone, label } = JOB_STATUS[status] ?? JOB_STATUS_FALLBACK;
  return <Badge tone={tone}>{label}</Badge>;
}

const APPLICATION_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  received: { tone: "accent", label: "Received" },
  forwarded: { tone: "success", label: "Forwarded" },
  failed: { tone: "danger", label: "Forwarding failed" },
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus | string }) {
  const config = APPLICATION_STATUS[status] ?? { tone: "neutral" as BadgeTone, label: status };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

const TENANT_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  active: { tone: "success", label: "Active" },
  trialing: { tone: "accent", label: "Trialing" },
  past_due: { tone: "warning", label: "Past due" },
  suspended: { tone: "danger", label: "Suspended" },
  canceled: { tone: "neutral", label: "Canceled" },
};

export function TenantStatusBadge({ status }: { status: string }) {
  const config = TENANT_STATUS[status] ?? { tone: "neutral" as BadgeTone, label: status };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
