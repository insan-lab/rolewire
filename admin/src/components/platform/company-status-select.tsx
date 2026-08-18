"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type CompanyStatus = "active" | "past_due" | "suspended";

const STATUS_CONFIG: Record<CompanyStatus, { label: string; bg: string; text: string; border: string }> = {
  active: {
    label: "Active",
    bg: "rgba(34, 197, 94, 0.12)",
    text: "#4ade80",
    border: "rgba(34, 197, 94, 0.3)",
  },
  past_due: {
    label: "Past Due",
    bg: "rgba(234, 179, 8, 0.12)",
    text: "#eab308",
    border: "rgba(234, 179, 8, 0.3)",
  },
  suspended: {
    label: "Suspended",
    bg: "rgba(239, 68, 68, 0.12)",
    text: "#f87171",
    border: "rgba(239, 68, 68, 0.3)",
  },
};

export function CompanyStatusSelect({
  companyId,
  currentStatus,
}: {
  companyId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<CompanyStatus>(
    (currentStatus as CompanyStatus) ?? "active",
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;

  async function handleChange(newStatus: CompanyStatus) {
    if (newStatus === status || saving) return;
    setSaving(true);
    setSuccess(false);

    try {
      const res = await fetch(
        `/api/platform-backend/v1/admin/platform/companies/${companyId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!res.ok) throw new Error("Failed to update company status");

      setStatus(newStatus);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update company status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as CompanyStatus)}
        className={cn(
          "rounded-md border px-2 py-1 text-xs font-medium focus:outline-none transition-colors cursor-pointer disabled:opacity-50",
        )}
        style={{
          backgroundColor: config.bg,
          color: config.text,
          borderColor: config.border,
        }}
      >
        <option value="active" className="bg-[var(--ink)] text-white">Active</option>
        <option value="past_due" className="bg-[var(--ink)] text-white">Past Due</option>
        <option value="suspended" className="bg-[var(--ink)] text-white">Suspended</option>
      </select>
      {saving && <Loader2 className="size-3.5 animate-spin text-copper-bright" />}
      {success && <Check className="size-3.5 text-emerald-400" />}
    </div>
  );
}
