/**
 * Convenience aliases over the generated OpenAPI types, so feature code never reaches into
 * `components["schemas"][...]` directly.
 */
import type { components } from "./generated";

type Schemas = components["schemas"];

export type TokenPair = Schemas["TokenPair"];
export type User = Schemas["UserOut"];
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
