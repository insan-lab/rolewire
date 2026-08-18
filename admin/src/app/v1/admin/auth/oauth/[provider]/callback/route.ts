/**
 * OAuth landing route. The provider redirects the browser here with `code` + `state`; this handler
 * forwards them to the backend server-side, turns the returned token pair into HttpOnly cookies,
 * and sends the user on to the app.
 *
 * The path deliberately mirrors the backend's own callback path because the backend builds the
 * provider `redirect_uri` from `OAUTH_REDIRECT_BASE_URL` — point that at the admin panel origin
 * (see admin/README.md) so the handshake finishes where the cookies can actually be set.
 */
import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { request } from "@/lib/api/fetch";
import { writeSession } from "@/lib/api/server";
import type { TokenPair } from "@/lib/api/types";
import { getAppOrigin, isOAuthProvider } from "@/lib/env";
import { OAUTH_INTENT_COOKIE, readIntent } from "@/lib/oauth";

export async function GET(req: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const url = req.nextUrl;
  const origin = getAppOrigin(req);
  const intent = readIntent(req.cookies.get(OAUTH_INTENT_COOKIE)?.value);

  const failure = (params: Record<string, string>) => {
    const target = new URL(
      intent === "link" ? "/settings/account" : "/auth/oauth/callback",
      origin,
    );
    for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
    const response = NextResponse.redirect(target);
    response.cookies.delete(OAUTH_INTENT_COOKIE);
    return response;
  };

  if (!isOAuthProvider(provider)) return failure({ error: "unknown_provider" });

  // The provider itself can bail out (user pressed "Cancel", app not approved, ...).
  const providerError = url.searchParams.get("error");
  if (providerError) {
    return failure({
      error: providerError,
      provider,
      description: url.searchParams.get("error_description") ?? "",
    });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return failure({ error: "missing_code_or_state", provider });

  try {
    const tokens = await request<TokenPair>(
      `/v1/admin/auth/oauth/${provider}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    );
    await writeSession(tokens);
    const target = new URL(
      intent === "link" ? `/settings/account?linked=${provider}` : "/dashboard",
      origin,
    );
    const response = NextResponse.redirect(target);
    response.cookies.delete(OAUTH_INTENT_COOKIE);
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      // 409 carries the human-readable reason (unverified email, identity already linked, ...).
      return failure({ error: String(error.status), provider, description: error.message });
    }
    return failure({ error: "callback_failed", provider });
  }
}
