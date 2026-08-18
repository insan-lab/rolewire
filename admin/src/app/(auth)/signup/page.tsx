import type { Metadata } from "next";
import Link from "next/link";

import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-display text-xl font-semibold tracking-tight text-paper">
          Create your account
        </h1>
        <p className="text-sm text-dim">
          This creates your company workspace and makes you its first admin.
        </p>
      </div>

      <div
        className="rounded-lg border p-5 shadow-card"
        style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
      >
        <SignupForm />

        <div className="my-5 flex items-center gap-3 text-xs text-dim">
          <span className="h-px flex-1" style={{ background: "var(--line-soft)" }} />
          or
          <span className="h-px flex-1" style={{ background: "var(--line-soft)" }} />
        </div>

        <OAuthButtons intent="signup" />
      </div>

      <p className="text-center text-sm text-dim">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-copper-bright hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
