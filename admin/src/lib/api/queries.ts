import "server-only";

/** Server-side read helpers. One place where paths, tags and query strings are constructed. */
import { CACHE_TAGS, apiRead } from "./server";
import type {
  Application,
  BillingOverview,
  Job,
  Page,
  Plan,
  PublicJob,
  StorageConfig,
} from "./types";

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export function listJobs(options: { status?: string; limit?: number; offset?: number } = {}) {
  return apiRead<Page<Job>>(`/v1/admin/jobs${query({ ...options, limit: options.limit ?? 50 })}`, {
    tags: [CACHE_TAGS.jobs],
  });
}

export function getJob(jobId: string) {
  return apiRead<Job>(`/v1/admin/jobs/${jobId}`, { tags: [CACHE_TAGS.jobs] });
}

export function listApplications(
  options: { jobId?: string; limit?: number; offset?: number } = {},
) {
  return apiRead<Page<Application>>(
    `/v1/admin/applications${query({
      job_id: options.jobId,
      limit: options.limit ?? 50,
      offset: options.offset,
    })}`,
    { tags: [CACHE_TAGS.applications] },
  );
}

export function getApplication(applicationId: string) {
  return apiRead<Application>(`/v1/admin/applications/${applicationId}`, {
    tags: [CACHE_TAGS.applications],
  });
}

export function listStorageConfigs() {
  return apiRead<StorageConfig[]>("/v1/admin/storage-configs", { tags: [CACHE_TAGS.storage] });
}

export function getBillingOverview() {
  return apiRead<BillingOverview>("/v1/admin/billing", { tags: [CACHE_TAGS.billing] });
}

export function listPlans() {
  return apiRead<Plan[]>("/v1/admin/billing/plans", { tags: [CACHE_TAGS.billing] });
}

/**
 * Fetch a published job through the *public* endpoint — unauthenticated, exactly what a tenant's
 * career page receives. Used for the API preview so the panel shows the real response rather than
 * a reconstruction (frontend spec §6.1 step 4).
 */
export async function getPublicJob(jobId: string): Promise<PublicJob | null> {
  const { request } = await import("./fetch");
  try {
    return await request<PublicJob>(`/v1/public/jobs/${jobId}`);
  } catch {
    return null;
  }
}
