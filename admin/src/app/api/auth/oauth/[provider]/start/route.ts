/**
 * Begin a social sign-in: ask the backend for the provider consent URL, then hand the browser off
 * with a top-level redirect (OAuth cannot complete inside a fetch).
 */
import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { request } from "@/lib/api/fetch";
import type { OAuthStart } from "@/lib/api/types";
import { getAppOrigin, isOAuthProvider } from "@/lib/env";
import { OAUTH_INTENT_COOKIE, intentCookieOptions } from "@/lib/oauth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const origin = getAppOrigin(req);
  if (!isOAuthProvider(provider)) {
    return NextResponse.redirect(new URL("/login?error=unknown_provider", origin));
  }

  try {
    const start = await request<OAuthStart>(`/v1/admin/auth/oauth/${provider}/start`);
    const response = NextResponse.redirect(start.authorization_url);
    // Remembered so the callback knows whether to land on /dashboard or /settings/account.
    response.cookies.set(OAUTH_INTENT_COOKIE, "login", intentCookieOptions());
    return response;
  } catch (error) {
    const reason =
      error instanceof ApiError && error.status === 503 ? "provider_not_configured" : "oauth_start_failed";
    return NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
  }
}
