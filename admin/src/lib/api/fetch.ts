/**
 * Low-level backend fetch. No Next.js-specific imports, so this is usable from Server Components,
 * route handlers, middleware, and tests alike.
 */
import { API_URL } from "../env";
import { ApiError } from "./errors";

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | undefined;
  /** Next.js cache tags; mutations invalidate these via `revalidateTag` (frontend spec §5). */
  tags?: string[];
  revalidate?: number | false;
  signal?: AbortSignal;
  baseUrl?: string;
  headers?: Record<string, string>;
};

function buildUrl(path: string, baseUrl?: string): string {
  if (path.startsWith("http")) return path;
  return `${baseUrl ?? API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function rawRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = "GET", body, token, tags, revalidate, signal, baseUrl, headers } = options;

  const requestHeaders: Record<string, string> = { accept: "application/json", ...headers };
  if (token) requestHeaders.authorization = `Bearer ${token}`;
  if (body !== undefined) requestHeaders["content-type"] = "application/json";

  return fetch(buildUrl(path, baseUrl), {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    // Admin data is per-tenant and changes on mutation: never serve it from the full-route cache
    // unless a tag was explicitly supplied.
    cache: tags || revalidate !== undefined ? undefined : "no-store",
    next: tags || revalidate !== undefined ? { tags, revalidate } : undefined,
  });
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.headers.get("content-length") === "0") return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Perform a request and unwrap the JSON payload, throwing {@link ApiError} on any non-2xx. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await rawRequest(path, options);
  } catch (error) {
    // Connection refused / DNS failure — surface as a 503 so callers treat it like an outage.
    throw new ApiError(503, `cannot reach the Rolewire API (${(error as Error).message})`);
  }

  const payload = await parseBody(response);
  if (!response.ok) {
    const retryAfter = Number(response.headers.get("retry-after")) || undefined;
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? (payload as { detail: unknown }).detail
        : payload;
    throw new ApiError(response.status, detail, retryAfter);
  }
  return payload as T;
}
