/**
 * Session gatekeeper for the authenticated shell (frontend spec §4).
 *
 * Runs on `(app)` routes and the BFF proxy: decodes the access token (without verifying — the
 * backend does that on the real call), refreshes it when it is inside its last two minutes, and
 * redirects to /login?reason=session_expired when the refresh token is dead too.
 */
import { NextResponse, type NextRequest } from "next/server";

import type { TokenPair } from "@/lib/api/types";
import {
  ACCESS_COOKIE,
  type CookieNames,
  expiredCookies,
  needsRefresh,
  PLATFORM_COOKIES,
  REFRESH_COOKIE,
  sessionCookies,
} from "@/lib/session";

const API_BASE = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
  .replace(/\/$/, "");

const TENANT_COOKIES: CookieNames = { access: ACCESS_COOKIE, refresh: REFRESH_COOKIE };

type SessionConfig = {
  cookies: CookieNames;
  refreshPath: string;
  loginPath: string;
  defaultNext: string;
};

const TENANT_SESSION: SessionConfig = {
  cookies: TENANT_COOKIES,
  refreshPath: "/v1/admin/auth/refresh",
  loginPath: "/login",
  defaultNext: "/dashboard",
};

const PLATFORM_SESSION: SessionConfig = {
  cookies: PLATFORM_COOKIES,
  refreshPath: "/v1/admin/platform/auth/refresh",
  loginPath: "/platform/login",
  defaultNext: "/platform",
};

async function exchangeRefreshToken(refreshPath: string, token: string): Promise<TokenPair | null> {
  try {
    const response = await fetch(`${API_BASE}${refreshPath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: token }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as TokenPair;
  } catch {
    // Treat an unreachable API as "cannot refresh"; the request still proceeds with the old token
    // so the page itself can render the API-down error state rather than a login bounce.
    return null;
  }
}

function loginRedirect(request: NextRequest, session: SessionConfig, reason: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = session.loginPath;
  url.search = "";
  url.searchParams.set("reason", reason);
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (next && next !== session.defaultNext) url.searchParams.set("next", next);

  const response = NextResponse.redirect(url);
  for (const cookie of expiredCookies(session.cookies)) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

async function guard(request: NextRequest, session: SessionConfig): Promise<NextResponse> {
  const access = request.cookies.get(session.cookies.access)?.value;
  const refresh = request.cookies.get(session.cookies.refresh)?.value;

  if (!refresh) {
    return loginRedirect(request, session, access ? "session_expired" : "sign_in_required");
  }

  if (!needsRefresh(access)) {
    return NextResponse.next();
  }

  const tokens = await exchangeRefreshToken(session.refreshPath, refresh);
  if (!tokens) {
    // Distinguish a dead session from an unreachable API: only bounce when we have no usable token.
    return access ? NextResponse.next() : loginRedirect(request, session, "session_expired");
  }

  // Update the *request* cookies too, so the page/handler this request reaches sees the fresh
  // token rather than the one that is about to expire.
  request.cookies.set(session.cookies.access, tokens.access_token);
  request.cookies.set(session.cookies.refresh, tokens.refresh_token);

  const response = NextResponse.next({ request });
  for (const cookie of sessionCookies(tokens, session.cookies)) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const isPlatform =
    request.nextUrl.pathname.startsWith("/platform") ||
    request.nextUrl.pathname.startsWith("/api/platform-backend");
  return guard(request, isPlatform ? PLATFORM_SESSION : TENANT_SESSION);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/jobs/:path*",
    "/applications/:path*",
    "/settings/:path*",
    "/billing/:path*",
    "/api/backend/:path*",
    "/platform",
    "/platform/users/:path*",
    "/platform/companies/:path*",
    "/platform/jobs/:path*",
    "/platform/billing/:path*",
    "/api/platform-backend/:path*",
  ],
};
