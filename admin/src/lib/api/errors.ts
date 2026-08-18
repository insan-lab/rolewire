/** Shared error type for every API call, plus FastAPI error-shape normalization. */

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  readonly retryAfter?: number;

  constructor(status: number, detail: unknown, retryAfter?: number) {
    super(formatDetail(detail, status));
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.retryAfter = retryAfter;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

type ValidationItem = { loc?: (string | number)[]; msg?: string };

/**
 * FastAPI returns `{detail: string}` for handled errors and `{detail: [{loc, msg}]}` for request
 * validation failures. Flatten both into one readable sentence.
 */
export function formatDetail(detail: unknown, status = 0): string {
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = (detail as ValidationItem[])
      .map((item) => {
        const field = (item.loc ?? []).filter((part) => part !== "body").join(".");
        const message = item.msg?.replace(/^Value error,\s*/, "") ?? "is invalid";
        return field ? `${field}: ${message}` : message;
      })
      .filter(Boolean);
    if (messages.length) return messages.join("; ");
  }

  if (detail && typeof detail === "object" && "detail" in detail) {
    return formatDetail((detail as { detail: unknown }).detail, status);
  }

  return status ? `Request failed with status ${status}` : "Request failed";
}

/** Message shown to the user when we would otherwise leak internals. */
export function userFacingMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isRateLimited) {
      const wait = error.retryAfter ? ` Try again in ${error.retryAfter}s.` : "";
      return `Too many requests.${wait}`;
    }
    if (error.isServerError) return "Something went wrong on our side. Try again in a moment.";
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}
