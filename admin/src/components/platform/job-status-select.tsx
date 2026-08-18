"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type JobStatus = "draft" | "published" | "closed";

const STATUS_CONFIG: Record<JobStatus, { label: string; bg: string; text: string; border: string }> = {
  draft: {
    label: "Draft",
    bg: "rgba(156, 163, 175, 0.12)",
    text: "#9ca3af",
    border: "rgba(156, 163, 175, 0.3)",
  },
  published: {
    label: "Published",
    bg: "rgba(34, 197, 94, 0.12)",
    text: "#4ade80",
    border: "rgba(34, 197, 94, 0.3)",
  },
  closed: {
    label: "Closed",
    bg: "rgba(239, 68, 68, 0.12)",
    text: "#f87171",
    border: "rgba(239, 68, 68, 0.3)",
  },
};

export function JobStatusSelect({
  jobId,
  currentStatus,
}: {
  jobId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus>(
    (currentStatus as JobStatus) ?? "draft",
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;

  async function handleChange(newStatus: JobStatus) {
    if (newStatus === status || saving) return;
    setSaving(true);
    setSuccess(false);

    try {
      const res = await fetch(
        `/api/platform-backend/v1/admin/platform/jobs/${jobId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!res.ok) throw new Error("Failed to update job status");

      setStatus(newStatus);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update job status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as JobStatus)}
        className={cn(
          "rounded-md border px-2 py-1 text-xs font-medium focus:outline-none transition-colors cursor-pointer disabled:opacity-50",
        )}
        style={{
          backgroundColor: config.bg,
          color: config.text,
          borderColor: config.border,
        }}
      >
        <option value="draft" className="bg-[var(--ink)] text-white">Draft</option>
        <option value="published" className="bg-[var(--ink)] text-white">Published</option>
        <option value="closed" className="bg-[var(--ink)] text-white">Closed</option>
      </select>
      {saving && <Loader2 className="size-3.5 animate-spin text-copper-bright" />}
      {success && <Check className="size-3.5 text-emerald-400" />}
    </div>
  );
}
