"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { HardDrive, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/overlay";
import { Card, CardBody, CardHeader, Callout, EmptyState } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { createStorageConfigAction, deleteStorageConfigAction } from "@/lib/actions";
import type { StorageConfig, StorageType } from "@/lib/api/types";
import { STORAGE_TARGET_LABELS } from "@/lib/api/types";
import { formatDate, cn } from "@/lib/utils";
import {
  gdriveConfigSchema,
  s3ConfigSchema,
  telegramConfigSchema,
  type StorageConfigInput,
} from "@/lib/validation";

const TYPES: StorageType[] = ["s3", "gdrive", "telegram"];

export function StorageSettings({ configs }: { configs: StorageConfig[] }) {
  const router = useRouter();
  const toast = useToast();
  const [activeType, setActiveType] = useState<StorageType>("s3");
  const [pendingDelete, setPendingDelete] = useState<StorageConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const result = await deleteStorageConfigAction(pendingDelete.id);
    setDeleting(false);
    setPendingDelete(null);
    if (!result.ok) {
      toast.error("Couldn't remove destination", result.error);
      return;
    }
    toast.success("Destination removed");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Connected destinations"
          description="Free storage you control — Rolewire only holds encrypted write credentials."
        />
        {configs.length === 0 ? (
          <EmptyState
            icon={<HardDrive className="size-6" />}
            title="Nothing connected yet"
            body="Connect S3, Google Drive or Telegram below, then pick it as a job's storage target."
          />
        ) : (
          <ul className="divide-y divide-[var(--line-soft)]">
            {configs.map((config) => (
              <li key={config.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-paper">{config.name}</p>
                  <p className="truncate text-xs text-dim">
                    {STORAGE_TARGET_LABELS[config.type]} · {configSummary(config)} · connected{" "}
                    {formatDate(config.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDelete(config)}
                  aria-label={`Remove ${config.name}`}
                  className="shrink-0 rounded p-1.5 text-dim transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Connect a destination" />
        <div className="flex gap-1 border-b border-[var(--line-soft)] px-4 pt-3">
          {TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveType(type)}
              className={cn(
                "rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeType === type
                  ? "border-x border-t border-[var(--line-soft)] bg-[var(--ink-soft)] text-paper"
                  : "text-dim hover:text-paper",
              )}
            >
              {STORAGE_TARGET_LABELS[type]}
            </button>
          ))}
        </div>
        <CardBody>
          {activeType === "s3" ? <S3Form onSaved={() => router.refresh()} /> : null}
          {activeType === "gdrive" ? <GdriveForm onSaved={() => router.refresh()} /> : null}
          {activeType === "telegram" ? <TelegramForm onSaved={() => router.refresh()} /> : null}
        </CardBody>
      </Card>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Remove ${pendingDelete?.name ?? "this destination"}?`}
        description="Jobs still pointed at it will start failing uploads. It can't be removed while a job uses it."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={deleting} onClick={confirmDelete}>
              Remove
            </Button>
          </>
        }
      />
    </div>
  );
}

function configSummary(config: StorageConfig): string {
  const cfg = config.config as Record<string, unknown>;
  if (config.type === "s3") return String(cfg.bucket ?? "");
  if (config.type === "gdrive") return `folder ${cfg.folder_id ?? ""}`;
  return `chat ${cfg.chat_id ?? ""}`;
}

function useSaveConfig(onSaved: () => void) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  async function save(payload: StorageConfigInput, reset: () => void) {
    setError(null);
    const result = await createStorageConfigAction(payload);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Destination connected", `${result.data.name} is ready to use on a job.`);
    reset();
    onSaved();
  }

  return { save, error };
}

function S3Form({ onSaved }: { onSaved: () => void }) {
  const { save, error } = useSaveConfig(onSaved);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StorageConfigInput & { type: "s3" }>({
    resolver: zodResolver(s3ConfigSchema),
    defaultValues: {
      name: "",
      type: "s3",
      credentials: { access_key_id: "", secret_access_key: "" },
      config: { bucket: "", region: "", endpoint: "", prefix: "" },
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => save(values, () => reset()))} className="space-y-4" noValidate>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <Field label="Name" htmlFor="s3-name" error={errors.name?.message} hint="Shown when picking this on a job.">
        <Input id="s3-name" placeholder="Applicant résumés bucket" {...register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bucket" htmlFor="s3-bucket" error={errors.config?.bucket?.message}>
          <Input id="s3-bucket" {...register("config.bucket")} />
        </Field>
        <Field label="Region" htmlFor="s3-region" optional>
          <Input id="s3-region" placeholder="us-east-1" {...register("config.region")} />
        </Field>
        <Field label="Endpoint" htmlFor="s3-endpoint" optional hint="Leave blank for AWS S3.">
          <Input id="s3-endpoint" placeholder="https://nyc3.digitaloceanspaces.com" {...register("config.endpoint")} />
        </Field>
        <Field label="Key prefix" htmlFor="s3-prefix" optional>
          <Input id="s3-prefix" placeholder="rolewire/" {...register("config.prefix")} />
        </Field>
        <Field label="Access key ID" htmlFor="s3-access-key" error={errors.credentials?.access_key_id?.message}>
          <Input id="s3-access-key" autoComplete="off" {...register("credentials.access_key_id")} />
        </Field>
        <Field
          label="Secret access key"
          htmlFor="s3-secret-key"
          error={errors.credentials?.secret_access_key?.message}
        >
          <Input id="s3-secret-key" type="password" autoComplete="off" {...register("credentials.secret_access_key")} />
        </Field>
      </div>
      <Button type="submit" loading={isSubmitting}>
        Connect S3 bucket
      </Button>
    </form>
  );
}

function GdriveForm({ onSaved }: { onSaved: () => void }) {
  const { save, error } = useSaveConfig(onSaved);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StorageConfigInput & { type: "gdrive" }>({
    resolver: zodResolver(gdriveConfigSchema),
    defaultValues: {
      name: "",
      type: "gdrive",
      credentials: { service_account_json: "" },
      config: { folder_id: "" },
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => save(values, () => reset()))} className="space-y-4" noValidate>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <Field label="Name" htmlFor="gdrive-name" error={errors.name?.message}>
        <Input id="gdrive-name" placeholder="Team Drive – Applicants" {...register("name")} />
      </Field>
      <Field label="Folder ID" htmlFor="gdrive-folder" error={errors.config?.folder_id?.message} hint="The id segment from the folder's URL.">
        <Input id="gdrive-folder" {...register("config.folder_id")} />
      </Field>
      <Field
        label="Service account JSON"
        htmlFor="gdrive-json"
        error={errors.credentials?.service_account_json?.message}
        hint="Paste the full key file. It's encrypted before it touches the database."
      >
        <Textarea id="gdrive-json" rows={6} className="font-mono text-xs" {...register("credentials.service_account_json")} />
      </Field>
      <Button type="submit" loading={isSubmitting}>
        Connect Google Drive
      </Button>
    </form>
  );
}

function TelegramForm({ onSaved }: { onSaved: () => void }) {
  const { save, error } = useSaveConfig(onSaved);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StorageConfigInput & { type: "telegram" }>({
    resolver: zodResolver(telegramConfigSchema),
    defaultValues: { name: "", type: "telegram", credentials: { bot_token: "" }, config: { chat_id: "" } },
  });

  return (
    <form onSubmit={handleSubmit((values) => save(values, () => reset()))} className="space-y-4" noValidate>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <Callout tone="info">
        Files over 50MB can&rsquo;t be relayed through Telegram&rsquo;s Bot API — plan résumé uploads
        accordingly.
      </Callout>
      <Field label="Name" htmlFor="tg-name" error={errors.name?.message}>
        <Input id="tg-name" placeholder="Hiring team channel" {...register("name")} />
      </Field>
      <Field label="Chat ID" htmlFor="tg-chat" error={errors.config?.chat_id?.message} hint="Add the bot to the private channel, then use its numeric chat id.">
        <Input id="tg-chat" placeholder="-1001234567890" {...register("config.chat_id")} />
      </Field>
      <Field label="Bot token" htmlFor="tg-token" error={errors.credentials?.bot_token?.message}>
        <Input id="tg-token" type="password" autoComplete="off" {...register("credentials.bot_token")} />
      </Field>
      <Button type="submit" loading={isSubmitting}>
        Connect Telegram channel
      </Button>
    </form>
  );
}
