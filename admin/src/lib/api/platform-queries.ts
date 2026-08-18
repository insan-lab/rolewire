import "server-only";

/** Server-side read helpers for the platform-superadmin surface. Mirrors queries.ts. */
import { platformApiRead } from "./platform-server";
import type {
  Page,
  PlatformCompany,
  PlatformInvoice,
  PlatformJob,
  PlatformStats,
  PlatformUser,
} from "./types";

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export function getPlatformStats() {
  return platformApiRead<PlatformStats>("/v1/admin/platform/stats");
}

export function listPlatformUsers(options: { limit?: number; offset?: number } = {}) {
  return platformApiRead<Page<PlatformUser>>(
    `/v1/admin/platform/users${query({ limit: options.limit ?? 50, offset: options.offset })}`,
  );
}

export function listPlatformCompanies(options: { limit?: number; offset?: number } = {}) {
  return platformApiRead<Page<PlatformCompany>>(
    `/v1/admin/platform/companies${query({ limit: options.limit ?? 50, offset: options.offset })}`,
  );
}

export function listPlatformJobs(options: { limit?: number; offset?: number } = {}) {
  return platformApiRead<Page<PlatformJob>>(
    `/v1/admin/platform/jobs${query({ limit: options.limit ?? 50, offset: options.offset })}`,
  );
}

export function listPlatformBilling(options: { limit?: number; offset?: number } = {}) {
  return platformApiRead<Page<PlatformInvoice>>(
    `/v1/admin/platform/billing${query({ limit: options.limit ?? 50, offset: options.offset })}`,
  );
}
