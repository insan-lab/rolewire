"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  QuestionBuilder,
  defaultQuestions,
  toApiQuestions,
  validateQuestions,
  type DraftQuestion,
  type QuestionIssue,
} from "@/components/app/question-builder";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, CardBody, CardHeader, Callout } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { STORAGE_TARGET_LABELS, type StorageConfig, type StorageTarget } from "@/lib/api/types";
import { createJobAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

const STEPS = ["Details", "Questions", "Storage", "Review"] as const;

const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship", "temporary"];

type Details = {
  title: string;
  description: string;
  location: string;
  employment_type: string;
  department: string;
};

export function JobWizard({ storageConfigs }: { storageConfigs: StorageConfig[] }) {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<Details>({
    title: "",
    description: "",
    location: "",
    employment_type: "",
    department: "",
  });
  const [questions, setQuestions] = useState<DraftQuestion[]>(defaultQuestions());
  const [storageTarget, setStorageTarget] = useState<StorageTarget>("hosted");
  const [storageConfigId, setStorageConfigId] = useState<string>("");
  const [publishNow, setPublishNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questionIssues: QuestionIssue[] = useMemo(() => validateQuestions(questions), [questions]);
  const detailsValid = details.title.trim().length > 0;
  const matchingConfigs = storageConfigs.filter((config) => config.type === storageTarget);
  const storageValid = storageTarget === "hosted" || Boolean(storageConfigId);

  const canContinue =
    (step === 0 && detailsValid) ||
    (step === 1 && questionIssues.length === 0) ||
    (step === 2 && storageValid) ||
    step === 3;

  function payload(status: "draft" | "published") {
    return {
      title: details.title.trim(),
      description: details.description.trim() || null,
      location: details.location.trim() || null,
      employment_type: details.employment_type || null,
      department: details.department.trim() || null,
      status,
      storage_target: storageTarget,
      storage_config_id: storageTarget === "hosted" ? null : storageConfigId,
      questions: toApiQuestions(questions),
    };
  }

  /**
   * Nothing is written until this point: the wizard holds state client-side rather than creating a
   * draft after step 1 (frontend spec §11.1). An abandoned wizard leaves no row behind, and the
   * "save as draft" button covers the interrupted-session case explicitly.
   */
  async function submit(status: "draft" | "published") {
    setError(null);
    setSubmitting(true);
    const result = await createJobAction(payload(status));
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(
      status === "published" ? "Job published" : "Draft saved",
      status === "published" ? "It is now live on your public endpoints." : "Publish it when you are ready.",
    );
    router.push(`/jobs/${result.data.id}`);
  }

  return (
    <div className="space-y-5">      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => index < step && setStep(index)}
              disabled={index > step}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
                index === step && "bg-copper-bright font-medium text-ink",
                index < step && "text-copper-bright hover:bg-[var(--ink-soft)]",
                index > step && "cursor-default text-dim opacity-50",
              )}
            >
              <span
                className={cn(
                  "grid size-4 place-items-center rounded-full text-[0.625rem]",
                  index < step
                    ? "bg-[var(--signal)] text-ink font-bold"
                    : index === step
                      ? "bg-ink/30 text-ink"
                      : "bg-[var(--line-soft)] text-dim",
                )}
              >
                {index < step ? <Check className="size-3" /> : index + 1}
              </span>
              {label}
            </button>
            {index < STEPS.length - 1 ? <span className="font-mono text-dim">›</span> : null}
          </li>
        ))}
      </ol>

      {error ? <Callout tone="danger">{error}</Callout> : null}

      {step === 0 ? (
        <Card>
          <CardHeader title="Role details" description="Only the title is required to start." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title" htmlFor="title" className="sm:col-span-2">
              <Input
                id="title"
                value={details.title}
                autoFocus
                placeholder="Senior Backend Engineer"
                onChange={(event) => setDetails({ ...details, title: event.target.value })}
              />
            </Field>

            <Field
              label="Description"
              htmlFor="description"
              optional
              className="sm:col-span-2"
              hint="Plain text or Markdown. The public API returns this string as-is, so your career page decides how to render it."
            >
              <Textarea
                id="description"
                rows={8}
                value={details.description}
                onChange={(event) => setDetails({ ...details, description: event.target.value })}
              />
            </Field>

            <Field label="Location" htmlFor="location" optional>
              <Input
                id="location"
                value={details.location}
                placeholder="Dhaka · hybrid"
                onChange={(event) => setDetails({ ...details, location: event.target.value })}
              />
            </Field>

            <Field label="Department" htmlFor="department" optional>
              <Input
                id="department"
                value={details.department}
                placeholder="Engineering"
                onChange={(event) => setDetails({ ...details, department: event.target.value })}
              />
            </Field>

            <Field label="Employment type" htmlFor="employment_type" optional>
              <Select
                id="employment_type"
                value={details.employment_type}
                onChange={(event) => setDetails({ ...details, employment_type: event.target.value })}
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
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader
            title="Application questions"
            description="Field keys are what your career page posts back. Drag to reorder."
          />
          <CardBody>
            <QuestionBuilder questions={questions} onChange={setQuestions} issues={questionIssues} />
          </CardBody>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader
            title="Where uploaded files go"
            description="Applies to file questions on this job. Answers always live in Rolewire."
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
                        {target === "hosted"
                          ? "Counts against your plan's hosted storage quota."
                          : available
                            ? "Uses a destination you already connected."
                            : "Connect one in Settings → Storage first."}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {storageTarget !== "hosted" ? (
              matchingConfigs.length > 0 ? (
                <Field label="Destination" htmlFor="storage_config">
                  <Select
                    id="storage_config"
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
                  and come back — credentials are encrypted and never shown again.
                </Callout>
              )
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader
            title="Review"
            description="This is what your career page will receive once the job is published."
          />
          <CardBody className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Summary label="Title" value={details.title} />
              <Summary label="Questions" value={`${questions.length}`} />
              <Summary label="Files go to" value={STORAGE_TARGET_LABELS[storageTarget]} />
              <Summary
                label="Location"
                value={[details.department, details.location, details.employment_type].filter(Boolean).join(" · ") || "—"}
              />
            </dl>

            <div>
              <p className="mb-1.5 font-mono text-xs text-dim">
                GET /v1/public/jobs/{"{job_id}"}
              </p>
              <CodeBlock code={previewJson(details, questions)} label="preview" />
              <p className="mt-1.5 text-xs text-dim">
                <code className="font-mono">id</code>, <code className="font-mono">created_at</code> and{" "}
                <code className="font-mono">company</code> are filled in by the API.
              </p>
            </div>

            <label className="flex items-start gap-2.5 rounded-md border border-[var(--line-soft)] bg-[var(--ink-soft)] p-3 text-sm">
              <input
                type="checkbox"
                checked={publishNow}
                onChange={(event) => setPublishNow(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-paper">Publish immediately</span>
                <span className="block text-xs text-dim">
                  Published jobs are readable by anyone with the job id and accept applications right
                  away. Leave unchecked to save a draft.
                </span>
              </span>
            </label>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          {step > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(step - 1)}
              icon={<ArrowLeft className="size-4" />}
            >
              Back
            </Button>
          ) : (
            <Link href="/jobs" className="text-sm text-dim transition-colors hover:text-paper">
              Cancel
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step === STEPS.length - 1 ? (
            <>
              <Button
                type="button"
                variant="secondary"
                loading={submitting && !publishNow}
                onClick={() => submit("draft")}
              >
                Save as draft
              </Button>
              <Button
                type="button"
                loading={submitting && publishNow}
                disabled={!publishNow}
                onClick={() => submit("published")}
              >
                Publish job
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={!canContinue}
              onClick={() => setStep(step + 1)}
              icon={<ArrowRight className="size-4" />}
            >
              Continue
            </Button>
          )}
        </div>
      </div>

      {step === 1 && questionIssues.length > 0 ? (
        <p className="text-right text-xs text-red-500">
          Fix {questionIssues.length} problem{questionIssues.length === 1 ? "" : "s"} above to continue.
        </p>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-dim">{label}</dt>
      <dd className="font-medium text-paper">{value || "—"}</dd>
    </div>
  );
}


/** Mirrors the PublicJob schema so the preview matches the real response field for field. */
function previewJson(details: Details, questions: DraftQuestion[]): string {
  return JSON.stringify(
    {
      id: "<assigned on save>",
      title: details.title || "<title>",
      location: details.location || null,
      employment_type: details.employment_type || null,
      department: details.department || null,
      created_at: "<assigned on save>",
      description: details.description || null,
      company: "<your company name>",
      questions: toApiQuestions(questions).map((question) => ({
        field_key: question.field_key,
        label: question.label,
        type: question.question_type,
        options: question.options,
        required: question.required,
      })),
    },
    null,
    2,
  );
}
