import type { ReactNode } from "react";

import type { ApplicationStatus, JobStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-[var(--ink-soft)] text-dim ring-[var(--line-soft)]",
  accent: "bg-[rgba(192,122,62,0.15)] text-copper-bright ring-[var(--copper)]",
  success: "bg-[rgba(127,174,122,0.15)] text-[var(--signal)] ring-[var(--signal)]",
  warning: "bg-[rgba(251,191,36,0.15)] text-amber-400 ring-amber-500/30",
  danger: "bg-[rgba(248,113,113,0.15)] text-red-400 ring-red-500/30",
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
