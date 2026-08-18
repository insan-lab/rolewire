import type { Metadata } from "next";

import { PlatformLoginForm } from "@/components/platform/login-form";
import { Callout } from "@/components/ui/surface";

export const metadata: Metadata = { title: "Platform login", robots: { index: false, follow: false } };

const REASONS: Record<string, string> = {
  session_expired: "Your session expired. Log in again to continue.",
  sign_in_required: "Log in to reach that page.",
};

export default async function PlatformLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; next?: string }>;
}) {
  const { reason, next } = await searchParams;
  const notice = reason ? REASONS[reason] : undefined;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-white">Platform admin</h1>
        <p className="text-sm text-zinc-400">Cross-tenant view. Rolewire operators only.</p>
      </div>

      {notice ? <Callout tone="info">{notice}</Callout> : null}

      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card">
        <PlatformLoginForm next={next} />
      </div>
    </div>
  );
}
