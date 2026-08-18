/**
 * Zod schemas mirroring the backend's Pydantic constraints (frontend spec §2). They are the
 * client-side validation source for React Hook Form *and* the guard on this app's own route
 * handlers — the backend re-validates everything regardless.
 */
import { z } from "zod";

import { QUESTION_TYPES } from "./api/types";

export const emailSchema = z.string().trim().min(3, "Enter an email address").email("That email address is not valid");

// Backend: Field(min_length=8, max_length=256).
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(256, "That password is too long");

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "Use lowercase letters, numbers and hyphens")
  .optional()
  .or(z.literal(""));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  company_name: z.string().trim().min(1, "Enter your company name").max(200),
  slug: slugSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

// --- Jobs -------------------------------------------------------------------

export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

export const jobDetailsSchema = z.object({
  title: z.string().trim().min(1, "Give the role a title").max(300),
  description: z.string().max(20_000).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  employment_type: z.string().max(32).optional().or(z.literal("")),
  department: z.string().max(120).optional().or(z.literal("")),
});

export type JobDetailsInput = z.infer<typeof jobDetailsSchema>;

export const questionSchema = z
  .object({
    label: z.string().trim().min(1, "Every question needs a label").max(300),
    field_key: z
      .string()
      .regex(FIELD_KEY_PATTERN, "Start with a letter; use lowercase letters, numbers, underscores"),
    question_type: z.enum(QUESTION_TYPES as [string, ...string[]]),
    options: z.array(z.string().trim().min(1)).optional(),
    required: z.boolean(),
    sort_order: z.number().int().min(0),
  })
  .superRefine((question, ctx) => {
    const needsOptions = question.question_type === "select" || question.question_type === "multiselect";
    if (needsOptions && (!question.options || question.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Add at least one choice",
      });
    }
    if (needsOptions && question.options && new Set(question.options).size !== question.options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Choices must be unique" });
    }
    if (!needsOptions && question.options && question.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: `A ${question.question_type} question cannot have choices`,
      });
    }
  });

export const questionSetSchema = z.array(questionSchema).superRefine((questions, ctx) => {
  const keys = questions.map((question) => question.field_key);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  for (const duplicate of new Set(duplicates)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Field key "${duplicate}" is used more than once`,
    });
  }
});

export const atsWebhookSchema = z
  .string()
  .trim()
  .url("Enter a full URL")
  .startsWith("https://", "The webhook URL must use https")
  .optional()
  .or(z.literal(""));

// --- Storage ----------------------------------------------------------------

export const s3ConfigSchema = z.object({
  name: z.string().trim().min(1, "Name this destination").max(120),
  type: z.literal("s3"),
  credentials: z.object({
    access_key_id: z.string().trim().min(1, "Access key ID is required"),
    secret_access_key: z.string().trim().min(1, "Secret access key is required"),
  }),
  config: z.object({
    bucket: z.string().trim().min(1, "Bucket name is required"),
    region: z.string().trim().optional().or(z.literal("")),
    endpoint: z.string().trim().optional().or(z.literal("")),
    prefix: z.string().trim().optional().or(z.literal("")),
  }),
});

export const gdriveConfigSchema = z.object({
  name: z.string().trim().min(1, "Name this destination").max(120),
  type: z.literal("gdrive"),
  credentials: z.object({
    service_account_json: z.string().trim().min(1, "Paste the service account JSON"),
  }),
  config: z.object({
    folder_id: z.string().trim().min(1, "Folder ID is required"),
  }),
});

export const telegramConfigSchema = z.object({
  name: z.string().trim().min(1, "Name this destination").max(120),
  type: z.literal("telegram"),
  credentials: z.object({
    bot_token: z.string().trim().min(1, "Bot token is required"),
  }),
  config: z.object({
    chat_id: z.string().trim().min(1, "Chat ID is required"),
  }),
});

export const storageConfigSchema = z.discriminatedUnion("type", [
  s3ConfigSchema,
  gdriveConfigSchema,
  telegramConfigSchema,
]);

export type StorageConfigInput = z.infer<typeof storageConfigSchema>;

// --- Contact ----------------------------------------------------------------

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(120),
  email: emailSchema,
  message: z.string().trim().min(10, "A little more detail helps us answer properly").max(5_000),
});

export type ContactInput = z.infer<typeof contactSchema>;
