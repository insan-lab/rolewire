/**
 * Client-side API access for Client Components (TanStack Query hooks, forms).
 *
 * Requests go to the same-origin BFF proxy at /api/backend/*, which holds the HttpOnly session
 * cookie and attaches the bearer token server-side. The browser never handles a token.
 */
import { ApiError, formatDetail } from "./errors";

export const BACKEND_PROXY_PREFIX = "/api/backend";

export type BrowserRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export async function apiFetch<T>(
  path: string,
  { method = "GET", body, signal }: BrowserRequestOptions = {},
): Promise<T> {
  const response = await fetch(`${BACKEND_PROXY_PREFIX}${path.startsWith("/") ? path : `/${path}`}`, {
    method,
    headers: body === undefined ? { accept: "application/json" } : {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    // Same-origin so the HttpOnly session cookie is sent; SameSite=Lax blocks cross-site use.
    credentials: "same-origin",
    signal,
  });

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? (payload as { detail: unknown }).detail
        : payload;
    if (response.status === 401) {
      // The proxy already tried to refresh; the session is genuinely gone.
      window.location.href = "/login?reason=session_expired";
    }
    throw new ApiError(
      response.status,
      detail ?? formatDetail(null, response.status),
      Number(response.headers.get("retry-after")) || undefined,
    );
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Same-origin POST to one of this app's own route handlers (login, signup, contact, ...). */
export async function appPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, (payload as { detail?: unknown } | null)?.detail ?? payload);
  }
  return payload as T;
}
