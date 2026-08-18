"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type UserRole = "admin" | "member";

export function UserRoleSelect({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>((currentRole as UserRole) ?? "member");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleChange(newRole: UserRole) {
    if (newRole === role || saving) return;
    setSaving(true);
    setSuccess(false);

    try {
      const res = await fetch(
        `/api/platform-backend/v1/admin/platform/users/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        },
      );

      if (!res.ok) throw new Error("Failed to update user role");

      setRole(newRole);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update user role.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={role}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as UserRole)}
        className={cn(
          "rounded-md border border-[var(--line-soft)] bg-[var(--ink-soft)] px-2 py-1 text-xs font-medium text-paper focus:outline-none transition-colors cursor-pointer disabled:opacity-50 capitalize",
        )}
      >
        <option value="admin" className="bg-[var(--ink)] text-white">Admin</option>
        <option value="member" className="bg-[var(--ink)] text-white">Member</option>
      </select>
      {saving && <Loader2 className="size-3.5 animate-spin text-copper-bright" />}
      {success && <Check className="size-3.5 text-emerald-400" />}
    </div>
  );
}

export function UserVerificationToggle({
  userId,
  currentVerified,
}: {
  userId: string;
  currentVerified: boolean;
}) {
  const router = useRouter();
  const [verified, setVerified] = useState(currentVerified);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    if (saving) return;
    const nextVerified = !verified;
    setSaving(true);

    try {
      const res = await fetch(
        `/api/platform-backend/v1/admin/platform/users/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email_verified: nextVerified }),
        },
      );

      if (!res.ok) throw new Error("Failed to update verification status");

      setVerified(nextVerified);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update user verification.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={saving}
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1",
        verified
          ? "bg-[rgba(34,197,94,0.12)] text-emerald-400 border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.2)]"
          : "bg-[rgba(156,163,175,0.12)] text-gray-400 border-[rgba(156,163,175,0.3)] hover:bg-[rgba(156,163,175,0.2)]",
      )}
    >
      {saving ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        verified ? "Verified" : "Unverified"
      )}
    </button>
  );
}
