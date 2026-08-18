/** Shared bits of the OAuth handshake owned by this app. */
import { cookieAttributes, type CookieAttributes } from "./session";

export const OAUTH_INTENT_COOKIE = "rw_oauth_intent";

export type OAuthIntent = "login" | "link";

/** Ten minutes is comfortably longer than a consent screen takes and shorter than a session. */
export function intentCookieOptions(): CookieAttributes {
  return cookieAttributes(600);
}

export function readIntent(value: string | undefined): OAuthIntent {
  return value === "link" ? "link" : "login";
}

/**
 * Where the provider sends the browser after consent.
 *
 * The backend builds this URL from its own `OAUTH_REDIRECT_BASE_URL` setting, so that setting must
 * point at *this app*, not the API — the callback needs to set HttpOnly session cookies on the
 * panel's origin. The path below therefore mirrors the backend route path exactly.
 */
export const CALLBACK_PATH_TEMPLATE = "/v1/admin/auth/oauth/{provider}/callback";

export function callbackPath(provider: string): string {
  return CALLBACK_PATH_TEMPLATE.replace("{provider}", provider);
}
