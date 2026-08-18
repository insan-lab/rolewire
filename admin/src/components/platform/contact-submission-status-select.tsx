"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import type { ContactSubmissionStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  ContactSubmissionStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  pending: {
    label: "Pending",
    bg: "rgba(234, 179, 8, 0.12)",
    text: "#eab308",
    border: "rgba(234, 179, 8, 0.3)",
  },
  in_progress: {
    label: "In Progress",
    bg: "rgba(59, 130, 246, 0.12)",
    text: "#60a5fa",
    border: "rgba(59, 130, 246, 0.3)",
  },
  resolved: {
    label: "Resolved",
    bg: "rgba(34, 197, 94, 0.12)",
    text: "#4ade80",
    border: "rgba(34, 197, 94, 0.3)",
  },
  ignored: {
    label: "Ignored",
    bg: "rgba(156, 163, 175, 0.12)",
    text: "#9ca3af",
    border: "rgba(156, 163, 175, 0.3)",
  },
};

export function ContactSubmissionStatusSelect({
  submissionId,
  currentStatus,
}: {
  submissionId: string;
  currentStatus: ContactSubmissionStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ContactSubmissionStatus>(currentStatus);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  async function handleChange(newStatus: ContactSubmissionStatus) {
    if (newStatus === status || saving) return;
    setSaving(true);
    setSuccess(false);

    try {
      const res = await fetch(
        `/api/platform-backend/v1/admin/platform/contact-submissions/${submissionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!res.ok) throw new Error("Failed to update status");

      setStatus(newStatus);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update submission status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as ContactSubmissionStatus)}
        className={cn(
          "rounded-md border px-2.5 py-1 text-xs font-medium focus:outline-none transition-colors cursor-pointer disabled:opacity-50",
        )}
        style={{
          backgroundColor: config.bg,
          color: config.text,
          borderColor: config.border,
        }}
      >
        <option value="pending" className="bg-[var(--ink)] text-white">Pending</option>
        <option value="in_progress" className="bg-[var(--ink)] text-white">In Progress</option>
        <option value="resolved" className="bg-[var(--ink)] text-white">Resolved</option>
        <option value="ignored" className="bg-[var(--ink)] text-white">Ignored</option>
      </select>
      {saving && <Loader2 className="size-3.5 animate-spin text-copper-bright" />}
      {success && <Check className="size-3.5 text-emerald-400" />}
    </div>
  );
}
