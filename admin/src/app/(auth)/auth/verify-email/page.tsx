import type { Metadata } from "next";
import Link from "next/link";

import { Callout } from "@/components/ui/surface";
import { SUPPORT_EMAIL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Email verification",
  robots: { index: false, follow: false },
};

/**
 * Landing page for the verification link in Brevo-sent mail (frontend spec §3).
 *
 * The API as built has no email-verification endpoint yet: `users.email_verified` is set only when
 * a social provider vouches for the address (backend spec §5.3). So this page cannot confirm a
 * token — it explains the state honestly instead of pretending to verify. Wire it up once the
 * backend exposes a confirm endpoint.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Email verification</h1>

      <Callout tone="info" title="Not needed right now">
        <p>
          Rolewire does not require email verification to use your account
          {email ? ` (${email})` : ""}. Signing in with Google, GitHub or LinkedIn marks your address
          as verified automatically, because the provider confirms it.
        </p>
      </Callout>

      <p className="text-sm text-zinc-600">
        If you followed a verification link from an email and expected something to happen, nothing
        is broken — there is simply nothing to confirm yet.
      </p>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-md bg-accent-600 px-3.5 font-medium text-white hover:bg-accent-700"
        >
          Go to dashboard
        </Link>
        <Link
          href="/login"
          className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3.5 font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Log in
        </Link>
      </div>

      <p className="text-xs text-zinc-500">
        Something looks wrong with your account? Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent-700 hover:underline">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
