/**
 * Server-side API client for the platform-superadmin surface. Mirrors `server.ts` but reads the
 * separate platform cookies and hits `/v1/admin/platform/*`, so a tenant session can never be
 * mistaken for a platform one (see lib/session.ts).
 */
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  expiredCookies,
  isExpired,
  PLATFORM_ACCESS_COOKIE,
  PLATFORM_COOKIES,
  PLATFORM_REFRESH_COOKIE,
  readPlatformClaims,
  sessionCookies,
  type PlatformSessionClaims,
} from "../session";
import { ApiError } from "./errors";
import { request, type RequestOptions } from "./fetch";
import type { PlatformAdminAccount, TokenPair } from "./types";

async function accessToken(): Promise<string | undefined> {
  return (await cookies()).get(PLATFORM_ACCESS_COOKIE)?.value;
}

async function refreshToken(): Promise<string | undefined> {
  return (await cookies()).get(PLATFORM_REFRESH_COOKIE)?.value;
}

export async function refreshPlatformSession(): Promise<TokenPair | null> {
  const token = await refreshToken();
  if (!token) return null;
  try {
    const tokens = await request<TokenPair>("/v1/admin/platform/auth/refresh", {
      method: "POST",
      body: { refresh_token: token },
    });
    await writePlatformSession(tokens);
    return tokens;
  } catch {
    return null;
  }
}

export async function writePlatformSession(tokens: TokenPair): Promise<void> {
  const store = await cookies();
  for (const cookie of sessionCookies(tokens, PLATFORM_COOKIES)) {
    store.set(cookie.name, cookie.value, cookie.options);
  }
}

export async function clearPlatformSession(): Promise<void> {
  const store = await cookies();
  for (const cookie of expiredCookies(PLATFORM_COOKIES)) {
    store.set(cookie.name, cookie.value, cookie.options);
  }
}

type ApiCallOptions = Omit<RequestOptions, "token"> & { allowRefresh?: boolean };

export async function platformApi<T>(path: string, options: ApiCallOptions = {}): Promise<T> {
  const { allowRefresh = false, ...rest } = options;
  let token = await accessToken();

  if (allowRefresh && isExpired(token)) {
    const refreshed = await refreshPlatformSession();
    token = refreshed?.access_token ?? token;
  }

  try {
    return await request<T>(path, { ...rest, token });
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized && allowRefresh) {
      const refreshed = await refreshPlatformSession();
      if (refreshed) {
        return await request<T>(path, { ...rest, token: refreshed.access_token });
      }
    }
    throw error;
  }
}

export async function platformApiRead<T>(path: string, options: ApiCallOptions = {}): Promise<T> {
  try {
    return await platformApi<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) {
      redirect("/platform/login?reason=session_expired");
    }
    throw error;
  }
}

export async function getPlatformSessionClaims(): Promise<PlatformSessionClaims | null> {
  return readPlatformClaims(await accessToken());
}

export async function isPlatformSignedIn(): Promise<boolean> {
  const store = await cookies();
  return Boolean(store.get(PLATFORM_REFRESH_COOKIE)?.value);
}

export const getCurrentPlatformAdmin = cache(async (): Promise<PlatformAdminAccount> => {
  return platformApiRead<PlatformAdminAccount>("/v1/admin/platform/auth/me");
});

export async function requirePlatformAdmin(): Promise<PlatformAdminAccount> {
  if (!(await isPlatformSignedIn())) redirect("/platform/login?reason=session_expired");
  return getCurrentPlatformAdmin();
}
