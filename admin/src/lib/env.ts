/**
 * Environment configuration, read once and validated at module load so a misconfigured
 * deployment fails loudly instead of producing confusing 500s deeper in a request.
 */

const isServer = typeof window === "undefined";

function required(name: string, value: string | undefined, fallback?: string): string {
  if (value && value.length > 0) return value.replace(/\/$/, "");
  if (fallback !== undefined) return fallback.replace(/\/$/, "");
  throw new Error(`missing required environment variable ${name}`);
}

/** Server-to-server base URL — stays on the internal Docker network (frontend spec §9). */
export const API_URL = isServer
  ? required(
      "API_URL",
      process.env.API_URL,
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
    )
  : "";

/** Browser-facing API base. Only needed for links out to the API (docs, health). */
export const PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

export const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
export const PADDLE_ENVIRONMENT =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";

export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@rolewire.io";

export const IS_PROD = process.env.NODE_ENV === "production";

/** Providers offered on the login/signup screens, matching backend spec §5.3. */
export const OAUTH_PROVIDERS = ["google", "github", "facebook", "linkedin"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}
