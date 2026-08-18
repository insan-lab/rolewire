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
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Create your account</h1>
        <p className="text-sm text-zinc-500">
          This creates your company workspace and makes you its first admin.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card">
        <SignupForm />

        <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200" />
          or
          <span className="h-px flex-1 bg-zinc-200" />
        </div>

        <OAuthButtons intent="signup" />
      </div>

      <p className="text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
