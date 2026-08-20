import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

import { ChangeEmailForm } from "@/components/app/change-email-form";
import { ChangePasswordForm } from "@/components/app/change-password-form";
import { UnlinkProviderButton } from "@/components/app/unlink-provider-button";
import { UpdateCompanyForm } from "@/components/app/update-company-form";
import { Badge } from "@/components/ui/badge";
import { CopyableId } from "@/components/ui/copyable-id";
import { Card, CardBody, CardHeader, Callout, PageHeader } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/api/server";
import { ENABLED_OAUTH_PROVIDERS, OAUTH_PROVIDERS, type OAuthProvider } from "@/lib/env";

export const metadata: Metadata = { title: "Account" };

const LABELS: Record<OAuthProvider, string> = {
  google: "Google",
  github: "GitHub",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};

const ERROR_MESSAGES: Record<string, string> = {
  unknown_provider: "Rolewire supports Google, GitHub, Facebook and LinkedIn.",
  provider_not_configured: "That provider isn't configured on this deployment yet.",
  oauth_start_failed: "Couldn't start that sign-in. Try again in a moment.",
};

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string; error?: string }>;
}) {
  const [user, { linked, error }] = await Promise.all([getCurrentUser(), searchParams]);
  const linkedSet = new Set(user.oauth_providers);

  return (
    <>
      <PageHeader title="Account" description="Your sign-in and identity for this workspace." />

      <div className="space-y-5">
        {linked ? (
          <Callout tone="success">{LABELS[linked as OAuthProvider] ?? linked} linked to your account.</Callout>
        ) : null}
        {error ? <Callout tone="danger">{ERROR_MESSAGES[error] ?? "That didn't work. Try again."}</Callout> : null}

        <Card>
          <CardHeader title="Email" />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-paper">{user.email}</p>
              {user.email_verified ? (
                <Badge tone="success">
                  <CheckCircle2 className="size-3" /> Verified
                </Badge>
              ) : (
                <Badge tone="warning">Unverified</Badge>
              )}
            </div>
            <ChangeEmailForm emailVerified={user.email_verified} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Password" />
          <CardBody>
            <ChangePasswordForm hasPassword={user.has_password} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Company & System Identifiers"
            description="Your organization name and unique UUIDs for API integrations and technical support."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {user.company_name ? (
              <div className="sm:col-span-2">
                {user.role === "admin" ? (
                  <UpdateCompanyForm companyName={user.company_name} companySlug={user.company_slug ?? null} />
                ) : (
                  <>
                    <p className="mb-1 text-xs text-dim">Company Name</p>
                    <p className="text-base font-semibold text-paper">{user.company_name}</p>
                    {user.company_slug ? (
                      <p className="font-mono text-xs text-dim">Slug: {user.company_slug}</p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
            <div>
              <p className="mb-1.5 font-mono text-xs text-dim">User ID (UUID)</p>
              <CopyableId id={user.id} label="User ID" />
            </div>
            <div>
              <p className="mb-1.5 font-mono text-xs text-dim">Company / Workspace ID (UUID)</p>
              <CopyableId id={user.tenant_id} label="Company ID" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Linked sign-in providers"
            description="Add more ways to sign in, or remove ones you no longer use."
          />
          <ul className="divide-y divide-[var(--line-soft)]">
            {OAUTH_PROVIDERS.filter((provider) => ENABLED_OAUTH_PROVIDERS.includes(provider) || linkedSet.has(provider)).map((provider) => {
              const isLinked = linkedSet.has(provider);
              const onlyLoginMethod = isLinked && !user.has_password && linkedSet.size === 1;
              return (
                <li key={provider} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-paper">{LABELS[provider]}</p>
                    <p className="text-xs text-dim">
                      {isLinked ? "Linked" : "Not linked"}
                      {onlyLoginMethod ? " · your only sign-in method" : ""}
                    </p>
                  </div>
                  {isLinked ? (
                    onlyLoginMethod ? (
                      <span className="text-xs text-dim opacity-50">Can&rsquo;t unlink</span>
                    ) : (
                      <UnlinkProviderButton provider={provider} label={LABELS[provider]} />
                    )
                  ) : (
                    <form method="POST" action={`/api/auth/oauth/${provider}/link`}>
                      <button
                        type="submit"
                        className="h-8 rounded-md border border-[var(--line-soft)] bg-[var(--ink-soft)] px-2.5 text-sm text-dim transition-colors hover:text-paper"
                      >
                        Link
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
