/**
 * Session cookie helpers. Edge-safe: no `next/headers` import, so `middleware.ts` can use this.
 *
 * Deviation from frontend spec §4, forced by the backend as built: the FastAPI service returns the
 * JWT pair as a JSON body (`TokenPair`) and does not set cookies itself. So this app acts as the
 * BFF — its route handlers exchange credentials for tokens server-side and store them in HttpOnly
 * cookies. The security property the spec actually asks for is preserved: tokens are never
 * readable by client JS, and the browser never sees an Authorization header. Client Components
 * call same-origin `/api/backend/*`, which attaches the bearer token server-side.
 */
import { decodeJwt } from "jose";

import type { TokenPair } from "./api/types";

export const ACCESS_COOKIE = "rw_access";
export const REFRESH_COOKIE = "rw_refresh";

/** Refresh this many seconds before the access token actually expires (spec §4: ~2 minutes). */
export const REFRESH_SKEW_SECONDS = 120;

const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // mirrors the backend's 30-day refresh TTL

export type CookieAttributes = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

export function cookieAttributes(maxAge: number): CookieAttributes {
  return {
    httpOnly: true,
    // Secure would make cookies unusable over plain-HTTP localhost during development.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export type SessionCookie = { name: string; value: string; options: CookieAttributes };

/** The cookie pair to write after a successful login/signup/refresh/OAuth exchange. */
export function sessionCookies(tokens: TokenPair): SessionCookie[] {
  return [
    {
      name: ACCESS_COOKIE,
      value: tokens.access_token,
      // Keep the cookie alive slightly past token expiry so middleware can read the stale token
      // and decide to refresh, rather than seeing no cookie at all and bouncing to /login.
      options: cookieAttributes((tokens.expires_in ?? 900) + REFRESH_MAX_AGE_SECONDS),
    },
    {
      name: REFRESH_COOKIE,
      value: tokens.refresh_token,
      options: cookieAttributes(REFRESH_MAX_AGE_SECONDS),
    },
  ];
}

export function expiredCookies(): SessionCookie[] {
  return [ACCESS_COOKIE, REFRESH_COOKIE].map((name) => ({
    name,
    value: "",
    options: cookieAttributes(0),
  }));
}

/**
 * Read `exp` from a JWT without verifying the signature — verification is the backend's job on
 * the actual API call. This only decides *when to refresh*.
 */
export function tokenExpiry(token: string | undefined): number | null {
  if (!token) return null;
  try {
    const claims = decodeJwt(token);
    return typeof claims.exp === "number" ? claims.exp : null;
  } catch {
    return null;
  }
}

export function isExpired(token: string | undefined, nowSeconds = Date.now() / 1000): boolean {
  const exp = tokenExpiry(token);
  if (exp === null) return true;
  return exp <= nowSeconds;
}

/** True when the token is gone, unreadable, or inside its final {@link REFRESH_SKEW_SECONDS}. */
export function needsRefresh(token: string | undefined, nowSeconds = Date.now() / 1000): boolean {
  const exp = tokenExpiry(token);
  if (exp === null) return true;
  return exp - nowSeconds <= REFRESH_SKEW_SECONDS;
}

export type SessionClaims = {
  userId: string;
  tenantId: string;
  role: string;
};

export function readClaims(token: string | undefined): SessionClaims | null {
  if (!token) return null;
  try {
    const claims = decodeJwt(token);
    if (typeof claims.sub !== "string" || typeof claims.tenant_id !== "string") return null;
    return {
      userId: claims.sub,
      tenantId: claims.tenant_id,
      role: typeof claims.role === "string" ? claims.role : "member",
    };
  } catch {
    return null;
  }
}
