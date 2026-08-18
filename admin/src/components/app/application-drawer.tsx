"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { ApplicationStatusBadge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/surface";
import { Drawer } from "@/components/ui/overlay";
import type { Application, JobQuestion } from "@/lib/api/types";
import { applicantLabel, formatDateTime } from "@/lib/utils";

/**
 * Answers are a tenant-defined `{field_key: value}` bag (backend spec §4) — question labels are
 * only known when the caller already has the owning job's question set. Falls back to the raw
 * field_key otherwise, which is always correct even if less friendly.
 */
export function ApplicationDrawer({
  application,
  questions,
  open,
  onOpenChange,
}: {
  application: Application | null;
  questions?: JobQuestion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!application) return null;
  const labelFor = (key: string) => questions?.find((question) => question.field_key === key)?.label ?? key;
  const answers = Object.entries(application.answers as Record<string, unknown>);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={applicantLabel(application)}
      description={`Submitted ${formatDateTime(application.created_at)}`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <ApplicationStatusBadge status={application.status} />
          <Link
            href={`/applications/${application.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 hover:underline"
          >
            Open full page <ExternalLink className="size-3.5" />
          </Link>
        </div>

        {application.status === "failed" ? (
          <Callout tone="danger" title="Forwarding to the ATS webhook failed">
            Rolewire kept the application — only the outbound webhook delivery did not go through.
            There is no retry button yet; resend it from your ATS or contact support.
          </Callout>
        ) : null}

        {application.applicant_email ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Email</p>
            <p className="text-sm text-zinc-900">{application.applicant_email}</p>
          </div>
        ) : null}

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">Résumé</p>
          {application.resume_ref ? (
            <code className="block break-all rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs text-zinc-700">
              {application.resume_ref}
            </code>
          ) : (
            <p className="text-sm text-zinc-500">No file was attached to this application.</p>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            A direct download link is not available yet — this points at the file inside the job&rsquo;s
            configured storage.
          </p>
        </div>

        <dl className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
          {answers.map(([key, value]) => (
            <div key={key} className="px-3 py-2">
              <dt className="text-xs text-zinc-500">{labelFor(key)}</dt>
              <dd className="text-sm text-zinc-900">{formatAnswer(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Drawer>
  );
}

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "—";
  return String(value);
}
