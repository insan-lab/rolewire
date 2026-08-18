"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label, Select, Switch } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { QUESTION_TYPE_LABELS, QUESTION_TYPES, type QuestionType } from "@/lib/api/types";
import { slugifyFieldKey, uniqueFieldKey } from "@/lib/utils";

export type DraftQuestion = {
  /** Local-only stable id for drag-and-drop and React keys; never sent to the API. */
  uid: string;
  label: string;
  field_key: string;
  question_type: QuestionType;
  options: string[];
  required: boolean;
  /** False once the user edits the key by hand, so we stop overwriting their choice. */
  autoKey: boolean;
};

let counter = 0;
const nextUid = () => `q${(counter += 1)}-${Math.random().toString(36).slice(2, 7)}`;

export function makeQuestion(partial: Partial<DraftQuestion> = {}): DraftQuestion {
  return {
    uid: nextUid(),
    label: "",
    field_key: "",
    question_type: "text",
    options: [],
    required: true,
    autoKey: true,
    ...partial,
  };
}

/** Sensible starting set for a new job: the three things nearly every form asks for. */
export function defaultQuestions(): DraftQuestion[] {
  return [
    makeQuestion({ label: "Full name", field_key: "full_name", question_type: "text" }),
    makeQuestion({ label: "Email", field_key: "email", question_type: "email" }),
    makeQuestion({ label: "Résumé", field_key: "resume", question_type: "file" }),
  ];
}

export function fromApiQuestions(
  questions: { label: string; field_key: string; question_type: string; options?: string[] | null; required: boolean }[],
): DraftQuestion[] {
  return questions.map((question) =>
    makeQuestion({
      label: question.label,
      field_key: question.field_key,
      question_type: question.question_type as QuestionType,
      options: question.options ?? [],
      required: question.required,
      autoKey: false,
    }),
  );
}

/** Shape the API expects: sort_order is derived from list position. */
export function toApiQuestions(questions: DraftQuestion[]) {
  return questions.map((question, index) => ({
    label: question.label.trim(),
    field_key: question.field_key,
    question_type: question.question_type,
    options:
      question.question_type === "select" || question.question_type === "multiselect"
        ? question.options.map((option) => option.trim()).filter(Boolean)
        : null,
    required: question.required,
    sort_order: index,
  }));
}

export type QuestionIssue = { uid: string; message: string };

/**
 * Client-side validation mirroring the backend's rules, so a bad set never reaches the API:
 * unique field keys, non-empty labels, options only where the type allows them.
 */
export function validateQuestions(questions: DraftQuestion[]): QuestionIssue[] {
  const issues: QuestionIssue[] = [];
  const seen = new Map<string, number>();

  questions.forEach((question) => {
    if (!question.label.trim()) {
      issues.push({ uid: question.uid, message: "Add a label" });
    }
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(question.field_key)) {
      issues.push({
        uid: question.uid,
        message: "Field key must start with a letter and use only lowercase letters, numbers and underscores",
      });
    }
    const count = (seen.get(question.field_key) ?? 0) + 1;
    seen.set(question.field_key, count);
    if (count > 1) {
      issues.push({ uid: question.uid, message: `Field key “${question.field_key}” is already used` });
    }
    const needsOptions = question.question_type === "select" || question.question_type === "multiselect";
    const options = question.options.map((option) => option.trim()).filter(Boolean);
    if (needsOptions && options.length === 0) {
      issues.push({ uid: question.uid, message: "Add at least one choice" });
    }
    if (needsOptions && new Set(options).size !== options.length) {
      issues.push({ uid: question.uid, message: "Choices must be unique" });
    }
  });

  return issues;
}

export function QuestionBuilder({
  questions,
  onChange,
  issues = [],
}: {
  questions: DraftQuestion[];
  onChange: (questions: DraftQuestion[]) => void;
  issues?: QuestionIssue[];
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const issuesByUid = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of issues) {
      map.set(issue.uid, [...(map.get(issue.uid) ?? []), issue.message]);
    }
    return map;
  }, [issues]);

  function update(uid: string, changes: Partial<DraftQuestion>) {
    onChange(
      questions.map((question) => (question.uid === uid ? { ...question, ...changes } : question)),
    );
  }

  function remove(uid: string) {
    onChange(questions.filter((question) => question.uid !== uid));
  }

  function add() {
    onChange([...questions, makeQuestion()]);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = questions.findIndex((question) => question.uid === active.id);
    const to = questions.findIndex((question) => question.uid === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(questions, from, to));
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 ? (
        <Callout tone="warning" title="No questions yet">
          An application with no questions accepts an empty payload. Add at least a name and a way to
          reach the applicant.
        </Callout>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={questions.map((question) => question.uid)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {questions.map((question, index) => (
              <QuestionRow
                key={question.uid}
                question={question}
                index={index}
                takenKeys={questions.filter((other) => other.uid !== question.uid).map((other) => other.field_key)}
                messages={issuesByUid.get(question.uid) ?? []}
                onChange={(changes) => update(question.uid, changes)}
                onRemove={() => remove(question.uid)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={add}>
        Add question
      </Button>
    </div>
  );
}

function QuestionRow({
  question,
  index,
  takenKeys,
  messages,
  onChange,
  onRemove,
}: {
  question: DraftQuestion;
  index: number;
  takenKeys: string[];
  messages: string[];
  onChange: (changes: Partial<DraftQuestion>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.uid,
  });
  const fieldId = useId();
  const needsOptions = question.question_type === "select" || question.question_type === "multiselect";
  const [optionsText, setOptionsText] = useState(question.options.join("\n"));

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border bg-white p-3 ${
        messages.length ? "border-red-300" : "border-zinc-200"
      } ${isDragging ? "shadow-overlay" : "shadow-card"}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-6 cursor-grab rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          aria-label={`Reorder question ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <div className="grid flex-1 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-label`}>Question {index + 1}</Label>
            <Input
              id={`${fieldId}-label`}
              value={question.label}
              placeholder="e.g. Years of experience"
              onChange={(event) => {
                const label = event.target.value;
                const changes: Partial<DraftQuestion> = { label };
                if (question.autoKey) {
                  changes.field_key = uniqueFieldKey(slugifyFieldKey(label), takenKeys);
                }
                onChange(changes);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-key`}>Field key</Label>
            <Input
              id={`${fieldId}-key`}
              value={question.field_key}
              spellCheck={false}
              className="font-mono text-xs"
              onChange={(event) =>
                onChange({ field_key: event.target.value.toLowerCase(), autoKey: false })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-type`}>Answer type</Label>
            <Select
              id={`${fieldId}-type`}
              value={question.question_type}
              onChange={(event) => {
                const question_type = event.target.value as QuestionType;
                const keepsOptions = question_type === "select" || question_type === "multiselect";
                onChange({ question_type, options: keepsOptions ? question.options : [] });
              }}
            >
              {QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {QUESTION_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Switch
              id={`${fieldId}-required`}
              checked={question.required}
              onCheckedChange={(required) => onChange({ required })}
              label={`Question ${index + 1} required`}
            />
            <Label htmlFor={`${fieldId}-required`} className="text-xs text-zinc-500">
              Required
            </Label>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove question ${index + 1}`}
            className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {needsOptions ? (
        <div className="ml-8 mt-3 space-y-1.5">
          <Label htmlFor={`${fieldId}-options`}>Choices</Label>
          <textarea
            id={`${fieldId}-options`}
            rows={Math.max(2, question.options.length)}
            value={optionsText}
            placeholder={"Immediate\n2 weeks\n1 month"}
            onChange={(event) => {
              setOptionsText(event.target.value);
              onChange({
                options: event.target.value
                  .split("\n")
                  .map((option) => option.trim())
                  .filter(Boolean),
              });
            }}
            className="w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
          <p className="text-xs text-zinc-500">One choice per line.</p>
        </div>
      ) : null}

      {messages.length ? (
        <ul className="ml-8 mt-2 space-y-0.5">
          {messages.map((message) => (
            <li key={message} className="text-xs text-red-600" role="alert">
              {message}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
