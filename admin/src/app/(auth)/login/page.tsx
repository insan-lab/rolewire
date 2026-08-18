import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Callout } from "@/components/ui/surface";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: false } };

const REASONS: Record<string, string> = {
  session_expired: "Your session expired. Log in again to continue where you left off.",
  sign_in_required: "Log in to reach that page.",
};

const ERRORS: Record<string, string> = {
  unknown_provider: "That login provider is not supported.",
  provider_not_configured: "That provider is not enabled on this deployment yet.",
  oauth_start_failed: "We could not start that sign-in. Try again, or use your email and password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; error?: string; next?: string }>;
}) {
  const { reason, error, next } = await searchParams;
  const notice = reason ? REASONS[reason] : undefined;
  const failure = error ? (ERRORS[error] ?? "That sign-in did not complete.") : undefined;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Log in</h1>
        <p className="text-sm text-zinc-500">Manage your jobs and read incoming applications.</p>
      </div>

      {failure ? <Callout tone="danger">{failure}</Callout> : null}
      {notice && !failure ? <Callout tone="info">{notice}</Callout> : null}

      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card">
        <LoginForm next={next} />

        <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200" />
          or
          <span className="h-px flex-1 bg-zinc-200" />
        </div>

        <OAuthButtons intent="login" />
      </div>

      <p className="text-center text-sm text-zinc-600">
        No account yet?{" "}
        <Link href="/signup" className="font-medium text-accent-700 hover:underline">
          Create one
        </Link>
      </p>
      <p className="text-center text-xs text-zinc-500">
        Forgot your password? Password reset is not available yet — email support and we will help.
      </p>
    </div>
  );
}
