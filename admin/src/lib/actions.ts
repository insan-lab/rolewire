"use server";

/**
 * Mutations for jobs, questions, storage and account settings.
 *
 * Server Actions rather than client fetches so each mutation can `revalidateTag` the Server
 * Component reads it invalidates (frontend spec §5) — no hand-rolled cache busting, and the access
 * token never leaves the server.
 */
import { revalidateTag } from "next/cache";

import { userFacingMessage } from "@/lib/api/errors";
import { CACHE_TAGS, api } from "@/lib/api/server";
import type {
  Job,
  JobQuestion,
  JobQuestionInput,
  StorageConfig,
  UpgradeCheckout,
  User,
} from "@/lib/api/types";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(operation: () => Promise<T>, tags: string[]): Promise<ActionResult<T>> {
  try {
    const data = await operation();
    for (const tag of tags) revalidateTag(tag);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: userFacingMessage(error) };
  }
}

// --- Jobs -------------------------------------------------------------------

export async function createJobAction(payload: unknown): Promise<ActionResult<Job>> {
  return run(
    () => api<Job>("/v1/admin/jobs", { method: "POST", body: payload, allowRefresh: true }),
    [CACHE_TAGS.jobs],
  );
}

export async function updateJobAction(jobId: string, payload: unknown): Promise<ActionResult<Job>> {
  return run(
    () =>
      api<Job>(`/v1/admin/jobs/${jobId}`, { method: "PATCH", body: payload, allowRefresh: true }),
    [CACHE_TAGS.jobs],
  );
}

export async function deleteJobAction(jobId: string): Promise<ActionResult<null>> {
  return run(
    () => api<null>(`/v1/admin/jobs/${jobId}`, { method: "DELETE", allowRefresh: true }),
    [CACHE_TAGS.jobs],
  );
}

export async function replaceQuestionsAction(
  jobId: string,
  questions: JobQuestionInput[],
): Promise<ActionResult<JobQuestion[]>> {
  return run(
    () =>
      api<JobQuestion[]>(`/v1/admin/jobs/${jobId}/questions`, {
        method: "POST",
        body: { questions },
        allowRefresh: true,
      }),
    [CACHE_TAGS.jobs],
  );
}

// --- Storage ----------------------------------------------------------------

export async function createStorageConfigAction(payload: unknown): Promise<ActionResult<StorageConfig>> {
  return run(
    () =>
      api<StorageConfig>("/v1/admin/storage-configs", {
        method: "POST",
        body: payload,
        allowRefresh: true,
      }),
    [CACHE_TAGS.storage, CACHE_TAGS.jobs],
  );
}

export async function deleteStorageConfigAction(configId: string): Promise<ActionResult<null>> {
  return run(
    () => api<null>(`/v1/admin/storage-configs/${configId}`, { method: "DELETE", allowRefresh: true }),
    [CACHE_TAGS.storage],
  );
}

// --- Billing ----------------------------------------------------------------

export async function startUpgradeAction(payload: {
  plan_id: string;
  billing_cycle: "monthly" | "yearly";
  provider: "paddle" | "uddoktapay";
}): Promise<ActionResult<UpgradeCheckout>> {
  return run(
    () =>
      api<UpgradeCheckout>("/v1/admin/billing/upgrade", {
        method: "POST",
        body: payload,
        allowRefresh: true,
      }),
    [CACHE_TAGS.billing],
  );
}

// --- Account ----------------------------------------------------------------

export async function unlinkProviderAction(provider: string): Promise<ActionResult<null>> {
  return run(
    () => api<null>(`/v1/admin/auth/oauth/${provider}`, { method: "DELETE", allowRefresh: true }),
    [CACHE_TAGS.account],
  );
}

export async function changePasswordAction(payload: {
  current_password: string;
  new_password: string;
}): Promise<ActionResult<null>> {
  return run(
    () => api<null>("/v1/admin/auth/password", { method: "PATCH", body: payload, allowRefresh: true }),
    [CACHE_TAGS.account],
  );
}

export async function changeEmailAction(payload: {
  new_email: string;
  current_password: string;
}): Promise<ActionResult<User>> {
  return run(
    () => api<User>("/v1/admin/auth/email", { method: "PATCH", body: payload, allowRefresh: true }),
    [CACHE_TAGS.account],
  );
}

export async function updateCompanyAction(payload: {
  company_name: string;
  company_slug?: string;
}): Promise<ActionResult<User>> {
  return run(
    () => api<User>("/v1/admin/auth/company", { method: "PATCH", body: payload, allowRefresh: true }),
    [CACHE_TAGS.account],
  );
}
