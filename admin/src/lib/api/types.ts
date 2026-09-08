/**
 * Convenience aliases over the generated OpenAPI types, so feature code never reaches into
 * `components["schemas"][...]` directly.
 */
import type { components } from "./generated";

type Schemas = components["schemas"];

export type TokenPair = Schemas["TokenPair"];
export type User = Schemas["UserOut"] & {
  company_name?: string | null;
  company_slug?: string | null;
};
export type OAuthStart = Schemas["OAuthStartOut"];

export type Job = Schemas["JobOut"];
export type JobCreate = Schemas["JobCreate"];
export type JobUpdate = Schemas["JobUpdate"];
export type JobQuestion = Schemas["JobQuestionOut"];
export type JobQuestionInput = Schemas["JobQuestionIn"];
// Pydantic `Literal` aliases are inlined by FastAPI rather than emitted as named schemas, so these
// unions are derived from the shapes that use them — still generated, still exact.
export type JobStatus = Job["status"];
export type QuestionType = JobQuestion["question_type"];
export type StorageTarget = Job["storage_target"];

export type Application = Schemas["ApplicationOut"];
export type PublicJob = Schemas["PublicJob"];
export type PublicJobSummary = Schemas["PublicJobSummary"];

export type StorageConfig = Schemas["StorageConfigOut"];
export type StorageConfigCreate = Schemas["StorageConfigCreate"];
export type StorageType = StorageConfig["type"];

export type Plan = Schemas["PlanOut"];
export type Subscription = Schemas["SubscriptionOut"];
export type Invoice = Schemas["InvoiceOut"];
export type BillingOverview = Schemas["BillingOverview"];
export type UpgradeCheckout = Schemas["UpgradeCheckout"];

export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

/** `applications.status` values the backend writes (backend spec §4). */
export type ApplicationStatus = "received" | "forwarded" | "failed";

export const QUESTION_TYPES: QuestionType[] = [
  "text",
  "textarea",
  "select",
  "multiselect",
  "file",
  "boolean",
  "number",
  "email",
  "phone",
];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Short text",
  textarea: "Long text",
  select: "Single choice",
  multiselect: "Multiple choice",
  file: "File upload",
  boolean: "Yes / no",
  number: "Number",
  email: "Email",
  phone: "Phone",
};

export const STORAGE_TARGET_LABELS: Record<StorageTarget, string> = {
  hosted: "Rolewire hosted",
  s3: "Your S3 bucket",
  gdrive: "Your Google Drive",
  telegram: "Your Telegram channel",
};

/**
 * Hand-written rather than generated: these mirror `app/schemas/platform.py` exactly, but the
 * checked-in openapi.json snapshot predates that router and regenerating needs a live backend.
 * Regenerate with `pnpm gen:api` against a running API and these can move to the block above.
 */
export type PlatformAdminAccount = {
  id: string;
  email: string;
  created_at: string;
};

export type PlatformStats = {
  tenants_total: number;
  tenants_active: number;
  users_total: number;
  jobs_total: number;
  jobs_published: number;
  applications_total: number;
  subscriptions_active: number;
  revenue_paid_total: Record<string, string>;
};

export type PlatformUser = {
  id: string;
  email: string;
  role: string;
  email_verified: boolean;
  created_at: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
};

export type PlatformCompany = {
  id: string;
  name: string;
  slug: string;
  status: string;
  region: string | null;
  payment_provider: string | null;
  plan_name: string | null;
  created_at: string;
  user_count: number;
  job_count: number;
};

export type PlatformJob = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  tenant_id: string;
  tenant_name: string;
  application_count: number;
};

export type PlatformInvoice = {
  id: string;
  provider: string;
  amount: string;
  currency: string;
  status: string;
  created_at: string;
  tenant_id: string;
  tenant_name: string;
};

export type PlatformPlan = {
  id: string;
  name: string;
  monthly_price_usd: string | null;
  yearly_price_usd: string | null;
  monthly_price_bdt: string | null;
  yearly_price_bdt: string | null;
  paddle_product_id: string | null;
  paddle_monthly_price_id: string | null;
  paddle_yearly_price_id: string | null;
  paddle_monthly_price_id_previous: string | null;
  paddle_yearly_price_id_previous: string | null;
};

export type ContactSubmissionStatus = "pending" | "in_progress" | "resolved" | "ignored";

export type PlatformContactSubmission = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: ContactSubmissionStatus;
  created_at: string;
  updated_at: string;
};
