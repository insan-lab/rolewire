/**
 * Link an additional provider to the signed-in user (frontend spec §4).
 *
 * Reached by a form POST from /settings/account so the browser performs a top-level navigation and
 * the resulting provider redirect works. The backend associates the new `oauth_accounts` row using
 * the authenticated user in the JWT, not a query parameter.
 */
import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { api } from "@/lib/api/server";
import type { OAuthStart } from "@/lib/api/types";
import { getAppOrigin, isOAuthProvider } from "@/lib/env";
import { OAUTH_INTENT_COOKIE, intentCookieOptions } from "@/lib/oauth";

function back(req: NextRequest, error: string): NextResponse {
  return NextResponse.redirect(new URL(`/settings/account?error=${error}`, getAppOrigin(req)), 303);
}

export async function POST(req: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!isOAuthProvider(provider)) return back(req, "unknown_provider");

  try {
    const start = await api<OAuthStart>(`/v1/admin/auth/oauth/${provider}/link`, {
      method: "POST",
      allowRefresh: true,
    });
    // 303 so the browser switches this POST to a GET on the provider's consent page.
    const response = NextResponse.redirect(start.authorization_url, 303);
    response.cookies.set(OAUTH_INTENT_COOKIE, "link", intentCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) {
      return NextResponse.redirect(new URL("/login?reason=session_expired", getAppOrigin(req)), 303);
    }
    if (error instanceof ApiError && error.status === 503) return back(req, "provider_not_configured");
    return back(req, "oauth_start_failed");
  }
}
