/**
 * BFF proxy: /api/backend/v1/admin/... → {API_URL}/v1/admin/...
 *
 * Exists so Client Components can call the admin API without ever seeing a token: the session
 * lives in an HttpOnly cookie that only the server can read. Refreshes once on a 401 and replays
 * the request, since this is a route handler and may write cookies.
 */
import { NextResponse, type NextRequest } from "next/server";

import { rawRequest } from "@/lib/api/fetch";
import { refreshSession } from "@/lib/api/server";
import { APP_URL } from "@/lib/env";
import { ACCESS_COOKIE } from "@/lib/session";

/** Only the tenant-scoped admin surface is proxied — never public endpoints or webhooks. */
const ALLOWED_PREFIX = "v1/admin/";

const MUTATING_METHODS = new Set(["POST", "PATCH", "DELETE"]);

function forbidden(detail: string, status = 403): NextResponse {
  return NextResponse.json({ detail }, { status });
}

/**
 * Cookies are `SameSite=Lax`, which already blocks cross-site form posts, but an explicit origin
 * check costs nothing and covers same-site subdomain surprises.
 */
function originAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches from Next may omit Origin on GET
  const allowed = new Set([APP_URL, request.nextUrl.origin]);
  return allowed.has(origin.replace(/\/$/, ""));
}

async function handle(request: NextRequest, params: Promise<{ path?: string[] }>) {
  const { path = [] } = await params;
  const target = path.join("/");

  if (!target.startsWith(ALLOWED_PREFIX)) {
    return forbidden("only /v1/admin/* may be proxied", 404);
  }
  if (MUTATING_METHODS.has(request.method) && !originAllowed(request)) {
    return forbidden("cross-origin request rejected");
  }

  const search = request.nextUrl.search;
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  let payload: unknown;
  if (MUTATING_METHODS.has(request.method)) {
    const text = await request.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        return NextResponse.json({ detail: "request body must be JSON" }, { status: 400 });
      }
    }
  }

  const send = (bearer: string | undefined) =>
    rawRequest(`/${target}${search}`, {
      method: request.method as "GET" | "POST" | "PATCH" | "DELETE",
      token: bearer,
      body: payload,
    });

  let upstream: Response;
  try {
    upstream = await send(token);
    if (upstream.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) upstream = await send(refreshed.access_token);
    }
  } catch (error) {
    return NextResponse.json(
      { detail: `cannot reach the Rolewire API (${(error as Error).message})` },
      { status: 503 },
    );
  }

  const text = await upstream.text();
  const headers = new Headers({ "content-type": "application/json" });
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) headers.set("retry-after", retryAfter);

  return new NextResponse(text || null, { status: upstream.status, headers });
}

type Context = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, context: Context) {
  return handle(request, context.params);
}

export async function POST(request: NextRequest, context: Context) {
  return handle(request, context.params);
}

export async function PATCH(request: NextRequest, context: Context) {
  return handle(request, context.params);
}

export async function DELETE(request: NextRequest, context: Context) {
  return handle(request, context.params);
}
