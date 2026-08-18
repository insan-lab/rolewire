"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/overlay";
import { Card, CardBody, CardHeader, Callout } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { deleteJobAction, updateJobAction } from "@/lib/actions";
import { atsWebhookSchema } from "@/lib/validation";
import { STORAGE_TARGET_LABELS, type Job, type JobStatus, type StorageConfig, type StorageTarget } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship", "temporary"];

const STATUS_ACTIONS: { from: JobStatus[]; to: JobStatus; label: string }[] = [
  { from: ["draft", "closed"], to: "published", label: "Publish" },
  { from: ["published"], to: "closed", label: "Close" },
  { from: ["published", "closed"], to: "draft", label: "Revert to draft" },
];

export function JobEditor({ job, storageConfigs }: { job: Job; storageConfigs: StorageConfig[] }) {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState(job.title);
  const [description, setDescription] = useState(job.description ?? "");
  const [location, setLocation] = useState(job.location ?? "");
  const [department, setDepartment] = useState(job.department ?? "");
  const [employmentType, setEmploymentType] = useState(job.employment_type ?? "");
  const [storageTarget, setStorageTarget] = useState<StorageTarget>(job.storage_target);
  const [storageConfigId, setStorageConfigId] = useState(job.storage_config_id ?? "");
  const [atsWebhookUrl, setAtsWebhookUrl] = useState(job.ats_webhook_url ?? "");
  const [opencatsSync, setOpencatsSync] = useState(job.opencats_sync);

  const [saving, setSaving] = useState(false);
  const [statusPending, setStatusPending] = useState<JobStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchingConfigs = storageConfigs.filter((config) => config.type === storageTarget);
  const webhookCheck = atsWebhookSchema.safeParse(atsWebhookUrl);
  const dirty =
    title.trim() !== job.title ||
    description.trim() !== (job.description ?? "") ||
    location.trim() !== (job.location ?? "") ||
    department.trim() !== (job.department ?? "") ||
    employmentType !== (job.employment_type ?? "") ||
    storageTarget !== job.storage_target ||
    storageConfigId !== (job.storage_config_id ?? "") ||
    atsWebhookUrl.trim() !== (job.ats_webhook_url ?? "") ||
    opencatsSync !== job.opencats_sync;

  async function save() {
    if (!webhookCheck.success) {
      setError(webhookCheck.error.issues[0]?.message ?? "Fix the webhook URL");
      return;
    }
    setError(null);
    setSaving(true);
    const result = await updateJobAction(job.id, {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      department: department.trim() || null,
      employment_type: employmentType || null,
      storage_target: storageTarget,
      storage_config_id: storageTarget === "hosted" ? null : storageConfigId || null,
      ats_webhook_url: atsWebhookUrl.trim() || null,
      opencats_sync: opencatsSync,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Job updated");
    router.refresh();
  }

  async function setStatus(status: JobStatus) {
    setStatusPending(status);
    const result = await updateJobAction(job.id, { status });
    setStatusPending(null);
    if (!result.ok) {
      toast.error("Couldn't update status", result.error);
      return;
    }
    toast.success(
      status === "published"
        ? "Job published"
        : status === "closed"
          ? "Job closed"
          : "Reverted to draft",
    );
    router.refresh();
  }

  async function confirmDeleteJob() {
    setDeleting(true);
    const result = await deleteJobAction(job.id);
    setDeleting(false);
    if (!result.ok) {
      setConfirmDelete(false);
      toast.error("Couldn't delete job", result.error);
      return;
    }
    toast.success("Job deleted");
    router.push("/jobs");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_ACTIONS.filter((action) => action.from.includes(job.status)).map((action) => (
          <Button
            key={action.to}
            type="button"
            variant={action.to === "published" ? "primary" : "secondary"}
            size="sm"
            loading={statusPending === action.to}
            disabled={statusPending !== null}
            onClick={() => setStatus(action.to)}
          >
            {action.label}
          </Button>
        ))}
        <LinkButton href={`/jobs/${job.id}/questions`} variant="secondary" size="sm">
          Edit questions
        </LinkButton>
        <LinkButton href={`/jobs/${job.id}/applications`} variant="secondary" size="sm">
          View applications
        </LinkButton>
      </div>

      {error ? <Callout tone="danger">{error}</Callout> : null}

      <Card>
        <CardHeader title="Role details" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title" htmlFor="edit-title" className="sm:col-span-2">
            <Input id="edit-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Description" htmlFor="edit-description" optional className="sm:col-span-2">
            <Textarea
              id="edit-description"
              rows={8}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field label="Location" htmlFor="edit-location" optional>
            <Input id="edit-location" value={location} onChange={(event) => setLocation(event.target.value)} />
          </Field>
          <Field label="Department" htmlFor="edit-department" optional>
            <Input
              id="edit-department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            />
          </Field>
          <Field label="Employment type" htmlFor="edit-employment-type" optional>
            <Select
              id="edit-employment-type"
              value={employmentType}
              onChange={(event) => setEmploymentType(event.target.value)}
            >
              <option value="">Not specified</option>
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Where uploaded files go"
          description="Applies to file questions on this job."
        />
        <CardBody className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(STORAGE_TARGET_LABELS) as StorageTarget[]).map((target) => {
              const available = target === "hosted" || storageConfigs.some((config) => config.type === target);
              return (
                <label
                  key={target}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm transition-colors",
                    storageTarget === target ? "border-[var(--copper)] bg-[rgba(192,122,62,0.12)]" : "border-[var(--line-soft)] bg-[var(--ink-soft)]",
                    !available && "opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="storage_target"
                    value={target}
                    checked={storageTarget === target}
                    onChange={() => {
                      setStorageTarget(target);
                      const first = storageConfigs.find((config) => config.type === target);
                      setStorageConfigId(target === "hosted" ? "" : (first?.id ?? ""));
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-paper">{STORAGE_TARGET_LABELS[target]}</span>
                    <span className="block text-xs text-dim">
                      {available ? "" : "Connect one in Settings → Storage first."}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {storageTarget !== "hosted" ? (
            matchingConfigs.length > 0 ? (
              <Field label="Destination" htmlFor="edit-storage-config">
                <Select
                  id="edit-storage-config"
                  value={storageConfigId}
                  onChange={(event) => setStorageConfigId(event.target.value)}
                >
                  <option value="">Select a destination…</option>
                  {matchingConfigs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Callout tone="warning" title={`No ${STORAGE_TARGET_LABELS[storageTarget]} connected`}>
                <Link href="/settings/storage" className="font-medium underline">
                  Connect one
                </Link>{" "}
                and come back.
              </Callout>
            )
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="ATS forwarding"
          description="Forward every application on this job to your own ATS as it arrives."
        />
        <CardBody className="space-y-4">
          <Field
            label="Webhook URL"
            htmlFor="edit-ats-webhook"
            optional
            hint="Must be https. Rolewire POSTs the application payload here."
            error={atsWebhookUrl && !webhookCheck.success ? webhookCheck.error?.issues[0]?.message : undefined}
          >
            <Input
              id="edit-ats-webhook"
              placeholder="https://ats.example.com/webhooks/rolewire"
              value={atsWebhookUrl}
              onChange={(event) => setAtsWebhookUrl(event.target.value)}
            />
          </Field>
          <div className="flex items-center gap-2.5">
            <Switch id="edit-opencats" checked={opencatsSync} onCheckedChange={setOpencatsSync} label="Sync to hosted OpenCATS" />
            <label htmlFor="edit-opencats" className="text-sm text-paper">
              Sync to hosted OpenCATS
              <span className="block text-xs text-dim">
                Only takes effect once hosted OpenCATS is available for this workspace.
              </span>
            </label>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
          Delete job
        </Button>
        <Button type="button" loading={saving} disabled={!dirty} onClick={save}>
          Save changes
        </Button>
      </div>

      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this job?"
        description="This cannot be undone. Jobs with applications on file can't be deleted — close them instead."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={deleting} onClick={confirmDeleteJob}>
              Delete job
            </Button>
          </>
        }
      />
    </div>
  );
}
