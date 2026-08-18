/**
 * BFF proxy for the platform-superadmin surface: /api/platform-backend/v1/admin/platform/... →
 * {API_URL}/v1/admin/platform/... Mirrors app/api/backend, scoped to the platform prefix and
 * GET-only — every platform page today is read-only; add methods here if that changes.
 */
import { NextResponse, type NextRequest } from "next/server";

import { rawRequest } from "@/lib/api/fetch";
import { refreshPlatformSession } from "@/lib/api/platform-server";
import { PLATFORM_ACCESS_COOKIE } from "@/lib/session";

const ALLOWED_PREFIX = "v1/admin/platform/";

async function handle(request: NextRequest, params: Promise<{ path?: string[] }>) {
  const { path = [] } = await params;
  const target = path.join("/");

  if (!target.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json({ detail: "only /v1/admin/platform/* may be proxied" }, { status: 404 });
  }

  const search = request.nextUrl.search;
  const token = request.cookies.get(PLATFORM_ACCESS_COOKIE)?.value;

  const send = (bearer: string | undefined) => rawRequest(`/${target}${search}`, { token: bearer });

  let upstream: Response;
  try {
    upstream = await send(token);
    if (upstream.status === 401) {
      const refreshed = await refreshPlatformSession();
      if (refreshed) upstream = await send(refreshed.access_token);
    }
  } catch (error) {
    return NextResponse.json(
      { detail: `cannot reach the Rolewire API (${(error as Error).message})` },
      { status: 503 },
    );
  }

  const text = await upstream.text();
  return new NextResponse(text || null, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}

type Context = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, context: Context) {
  return handle(request, context.params);
}
