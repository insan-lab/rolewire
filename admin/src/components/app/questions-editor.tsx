"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  QuestionBuilder,
  fromApiQuestions,
  toApiQuestions,
  validateQuestions,
  type DraftQuestion,
} from "@/components/app/question-builder";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { replaceQuestionsAction } from "@/lib/actions";
import type { JobQuestion } from "@/lib/api/types";

export function QuestionsEditor({ jobId, initialQuestions }: { jobId: string; initialQuestions: JobQuestion[] }) {
  const router = useRouter();
  const toast = useToast();

  const [questions, setQuestions] = useState<DraftQuestion[]>(() => fromApiQuestions(initialQuestions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issues = useMemo(() => validateQuestions(questions), [questions]);

  async function save() {
    setError(null);
    setSaving(true);
    const result = await replaceQuestionsAction(jobId, toApiQuestions(questions));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Questions saved");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? <Callout tone="danger">{error}</Callout> : null}

      <QuestionBuilder questions={questions} onChange={setQuestions} issues={issues} />

      <div className="flex items-center justify-between gap-3">
        {issues.length > 0 ? (
          <p className="text-xs text-red-600">
            Fix {issues.length} problem{issues.length === 1 ? "" : "s"} above to save.
          </p>
        ) : (
          <span />
        )}
        <Button type="button" loading={saving} disabled={issues.length > 0} onClick={save}>
          Save questions
        </Button>
      </div>
    </div>
  );
}
