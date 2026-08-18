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

function parseBoolEnv(val: string | undefined, defaultVal = true): boolean {
  if (val === undefined || val === null || val === "") return defaultVal;
  const normalized = val.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export const OAUTH_ENABLE_MAP: Record<OAuthProvider, boolean> = {
  google: parseBoolEnv(process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLE ?? process.env.OAUTH_GOOGLE_ENABLE, true),
  github: parseBoolEnv(process.env.NEXT_PUBLIC_OAUTH_GITHUB_ENABLE ?? process.env.OAUTH_GITHUB_ENABLE, true),
  facebook: parseBoolEnv(process.env.NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLE ?? process.env.OAUTH_FACEBOOK_ENABLE, true),
  linkedin: parseBoolEnv(process.env.NEXT_PUBLIC_OAUTH_LINKEDIN_ENABLE ?? process.env.OAUTH_LINKEDIN_ENABLE, true),
};

export function isOAuthProviderEnabled(provider: OAuthProvider): boolean {
  return OAUTH_ENABLE_MAP[provider] ?? true;
}

export const ENABLED_OAUTH_PROVIDERS = OAUTH_PROVIDERS.filter(isOAuthProviderEnabled);

/**
 * Safely resolves the public origin of incoming server requests, handling reverse proxies,
 * NEXT_PUBLIC_APP_URL, Host / X-Forwarded-Host headers, and avoiding internal 0.0.0.0 bind IPs.
 */
export function getAppOrigin(req?: { headers: { get: (name: string) => string | null }; nextUrl?: { protocol?: string; origin?: string } }): string {
  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    if (forwardedHost) {
      const proto = req.headers.get("x-forwarded-proto") ?? "https";
      return `${proto}://${forwardedHost}`.replace(/\/$/, "");
    }
    const host = req.headers.get("host");
    if (host && !host.startsWith("0.0.0.0")) {
      const proto = req.nextUrl?.protocol || "https";
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }
  if (APP_URL && !APP_URL.includes("0.0.0.0")) {
    return APP_URL.replace(/\/$/, "");
  }
  if (req?.nextUrl?.origin) {
    return req.nextUrl.origin.replace("0.0.0.0", "localhost").replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

