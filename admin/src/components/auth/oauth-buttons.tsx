import { ENABLED_OAUTH_PROVIDERS, type OAuthProvider } from "@/lib/env";

const LABELS: Record<OAuthProvider, string> = {
  google: "Google",
  github: "GitHub",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};

/**
 * Full-page navigations, not fetches: an OAuth consent redirect cannot happen inside XHR
 * (frontend spec §4). Each link hits this app's own start route, which asks the API for the
 * provider URL and then redirects.
 */
export function OAuthButtons({ intent }: { intent: "login" | "signup" }) {
  if (ENABLED_OAUTH_PROVIDERS.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {ENABLED_OAUTH_PROVIDERS.map((provider) => (
        <a
          key={provider}
          href={`/api/auth/oauth/${provider}/start`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--line-soft)] bg-[var(--ink-soft)] px-3 text-sm font-medium text-paper transition-colors hover:bg-[var(--ink)]"
        >
          <ProviderMark provider={provider} />
          {LABELS[provider]}
        </a>
      ))}
      <p className="col-span-2 text-xs text-dim">
        {intent === "signup"
          ? "Signing up with a provider creates your company account with that email."
          : "Use the provider you signed up with, or link more later in account settings."}
      </p>
    </div>
  );
}

/** Small monochrome marks: no third-party brand assets to keep, no extra network requests. */
function ProviderMark({ provider }: { provider: OAuthProvider }) {
  const common = "size-4 shrink-0";
  switch (provider) {
    case "google":
      return (
        <svg aria-hidden viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M12 11v2.6h6.1c-.25 1.6-1.85 4.7-6.1 4.7A6.3 6.3 0 0 1 12 5.7c1.6 0 2.9.6 3.8 1.5l2-2A9.2 9.2 0 0 0 12 2.6 9.4 9.4 0 1 0 12 21.4c5.4 0 9-3.8 9-9.1 0-.6-.1-1-.2-1.3H12Z" />
        </svg>
      );
    case "github":
      return (
        <svg aria-hidden viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.4 9.4 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
        </svg>
      );
    case "facebook":
      return (
        <svg aria-hidden viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.24-1.46 1.5-1.46h1.6V4.45c-.28-.04-1.23-.12-2.34-.12-2.31 0-3.9 1.41-3.9 4v2.17H8v3h2.36V21h3.14Z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg aria-hidden viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M6.1 8.6H3.3V21h2.8V8.6ZM4.7 3a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4ZM21 13.9c0-3.1-1.7-4.6-3.9-4.6-1.5 0-2.3.8-2.7 1.4V8.6H11.7c.04.8 0 12.4 0 12.4h2.7v-6.9c0-.37.03-.74.14-1 .29-.74.94-1.5 2.05-1.5 1.45 0 2.03 1.1 2.03 2.7V21H21v-7.1Z" />
        </svg>
      );
  }
}
