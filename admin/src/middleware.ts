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
  REFRESH_COOKIE,
  expiredCookies,
  needsRefresh,
  sessionCookies,
} from "@/lib/session";

const API_BASE = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
  .replace(/\/$/, "");

async function exchangeRefreshToken(token: string): Promise<TokenPair | null> {
  try {
    const response = await fetch(`${API_BASE}/v1/admin/auth/refresh`, {
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

function loginRedirect(request: NextRequest, reason: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("reason", reason);
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (next && next !== "/dashboard") url.searchParams.set("next", next);

  const response = NextResponse.redirect(url);
  for (const cookie of expiredCookies()) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refresh) {
    return loginRedirect(request, access ? "session_expired" : "sign_in_required");
  }

  if (!needsRefresh(access)) {
    return NextResponse.next();
  }

  const tokens = await exchangeRefreshToken(refresh);
  if (!tokens) {
    // Distinguish a dead session from an unreachable API: only bounce when we have no usable token.
    return access ? NextResponse.next() : loginRedirect(request, "session_expired");
  }

  // Update the *request* cookies too, so the page/handler this request reaches sees the fresh
  // token rather than the one that is about to expire.
  request.cookies.set(ACCESS_COOKIE, tokens.access_token);
  request.cookies.set(REFRESH_COOKIE, tokens.refresh_token);

  const response = NextResponse.next({ request });
  for (const cookie of sessionCookies(tokens)) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/jobs/:path*",
    "/applications/:path*",
    "/settings/:path*",
    "/billing/:path*",
    "/api/backend/:path*",
  ],
};
