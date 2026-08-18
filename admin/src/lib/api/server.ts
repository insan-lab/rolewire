/**
 * Server-side API client: reads the session cookie, attaches the bearer token, and refreshes once
 * on a 401 when the calling context is allowed to write cookies (route handlers, Server Actions).
 *
 * Server Components can only *read* cookies, so an expired access token there results in a
 * redirect to /login — middleware normally refreshes ahead of that (see middleware.ts).
 */
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  expiredCookies,
  isExpired,
  readClaims,
  sessionCookies,
  type SessionClaims,
} from "../session";
import { ApiError } from "./errors";
import { request, type RequestOptions } from "./fetch";
import type { TokenPair, User } from "./types";

export const CACHE_TAGS = {
  jobs: "jobs",
  applications: "applications",
  storage: "storage",
  billing: "billing",
  account: "account",
} as const;

async function accessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

async function refreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

/**
 * Exchange the refresh cookie for a new pair. Returns null when the refresh token is gone or the
 * backend rejects it, in which case the caller should send the user to /login.
 */
export async function refreshSession(): Promise<TokenPair | null> {
  const token = await refreshToken();
  if (!token) return null;
  try {
    const tokens = await request<TokenPair>("/v1/admin/auth/refresh", {
      method: "POST",
      body: { refresh_token: token },
    });
    await writeSession(tokens);
    return tokens;
  } catch {
    return null;
  }
}

/** Only valid in a route handler or Server Action; Server Components cannot mutate cookies. */
export async function writeSession(tokens: TokenPair): Promise<void> {
  const store = await cookies();
  for (const cookie of sessionCookies(tokens)) {
    store.set(cookie.name, cookie.value, cookie.options);
  }
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  for (const cookie of expiredCookies()) {
    store.set(cookie.name, cookie.value, cookie.options);
  }
}

type ApiCallOptions = Omit<RequestOptions, "token"> & {
  /** Set to false inside Server Components, where cookies are read-only. */
  allowRefresh?: boolean;
};

/** Authenticated call as the signed-in tenant user. */
export async function api<T>(path: string, options: ApiCallOptions = {}): Promise<T> {
  const { allowRefresh = false, ...rest } = options;
  let token = await accessToken();

  if (allowRefresh && isExpired(token)) {
    const refreshed = await refreshSession();
    token = refreshed?.access_token ?? token;
  }

  try {
    return await request<T>(path, { ...rest, token });
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized && allowRefresh) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return await request<T>(path, { ...rest, token: refreshed.access_token });
      }
    }
    throw error;
  }
}

/** Read path for Server Components: authenticated GET that bounces to /login on a dead session. */
export async function apiRead<T>(path: string, options: ApiCallOptions = {}): Promise<T> {
  try {
    return await api<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) {
      redirect("/login?reason=session_expired");
    }
    throw error;
  }
}

/** Session claims from the cookie, without a round-trip to the API. */
export async function getSessionClaims(): Promise<SessionClaims | null> {
  return readClaims(await accessToken());
}

export async function isSignedIn(): Promise<boolean> {
  const store = await cookies();
  return Boolean(store.get(REFRESH_COOKIE)?.value);
}

/** Current user, deduplicated per request render pass. */
export const getCurrentUser = cache(async (): Promise<User> => {
  return apiRead<User>("/v1/admin/auth/me", { tags: [CACHE_TAGS.account] });
});

export async function requireUser(): Promise<User> {
  if (!(await isSignedIn())) redirect("/login?reason=session_expired");
  return getCurrentUser();
}
