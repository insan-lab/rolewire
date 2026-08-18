import type { Metadata } from "next";
import Link from "next/link";

import { Callout } from "@/components/ui/surface";
import { SUPPORT_EMAIL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign-in problem",
  robots: { index: false, follow: false },
};

/**
 * Error-display route for a social sign-in that did not complete (frontend spec §4).
 *
 * The happy path never renders this: the callback handler sets the session and redirects straight
 * to /dashboard. Anything that lands here has a reason worth showing in plain language.
 */
const MESSAGES: Record<string, { title: string; body: string }> = {
  access_denied: {
    title: "Sign-in cancelled",
    body: "You declined the permission request, so nothing was shared and no account was created.",
  },
  missing_code_or_state: {
    title: "That sign-in link is incomplete",
    body: "The provider did not return the values we need. Start again from the login page — the request may have been opened twice or from a stale tab.",
  },
  unknown_provider: {
    title: "Unsupported provider",
    body: "Rolewire supports Google, GitHub, Facebook and LinkedIn.",
  },
  callback_failed: {
    title: "We could not finish that sign-in",
    body: "The provider responded, but the exchange failed. Try again, or log in with your email and password.",
  },
  "400": {
    title: "That sign-in could not be verified",
    body: "The one-time sign-in request expired or was already used. Start again from the login page.",
  },
  "409": {
    title: "This email already has an account",
    body: "Log in with your email and password, then link the provider from account settings.",
  },
};

export default async function OAuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; provider?: string; description?: string }>;
}) {
  const { error, provider, description } = await searchParams;
  const message = (error ? MESSAGES[error] : undefined) ?? {
    title: "That sign-in did not complete",
    body: "Try again from the login page, or use your email and password.",
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{message.title}</h1>

      <Callout tone="warning">
        <p>{message.body}</p>
        {/* The backend's 409 detail explains exactly what is wrong (unverified provider email,
            identity already linked elsewhere), so show it rather than paraphrasing. */}
        {description ? <p className="mt-2 text-[0.8125rem]">{description}</p> : null}
        {provider ? (
          <p className="mt-2 text-xs uppercase tracking-wide opacity-70">provider: {provider}</p>
        ) : null}
      </Callout>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/login"
          className="inline-flex h-9 items-center rounded-md bg-accent-600 px-3.5 font-medium text-white hover:bg-accent-700"
        >
          Back to login
        </Link>
        <Link
          href="/signup"
          className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3.5 font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Create an account instead
        </Link>
      </div>

      <p className="text-xs text-zinc-500">
        Still stuck? Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent-700 hover:underline">
          {SUPPORT_EMAIL}
        </a>{" "}
        and mention which provider you used.
      </p>
    </div>
  );
}
