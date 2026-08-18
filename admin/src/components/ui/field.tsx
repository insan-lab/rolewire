"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-500 aria-[invalid=true]:border-red-400";

export function Label({
  children,
  className,
  htmlFor,
  optional,
}: {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <LabelPrimitive.Root
      htmlFor={htmlFor}
      className={cn("flex items-baseline gap-1.5 text-sm font-medium text-zinc-800", className)}
    >
      {children}
      {optional ? <span className="text-xs font-normal text-zinc-400">optional</span> : null}
    </LabelPrimitive.Root>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL, "h-9", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 5, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(CONTROL, "resize-y", className)} {...props} />;
  },
);

/**
 * Native select rather than a Radix listbox: it is keyboard- and screen-reader-correct for free,
 * and every use here is a short, non-searchable list.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(CONTROL, "h-9 pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-xs text-red-600">
      {children}
    </p>
  );
}

export function Hint({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="text-xs text-zinc-500">
      {children}
    </p>
  );
}

/** Label + control + hint/error, wired up with the right aria attributes. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} optional={optional}>
        {label}
      </Label>
      {children}
      {error ? <FieldError id={`${htmlFor}-error`}>{error}</FieldError> : null}
      {!error && hint ? <Hint id={`${htmlFor}-hint`}>{hint}</Hint> : null}
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  id,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  label?: string;
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border border-transparent transition-colors",
        checked ? "bg-accent-600" : "bg-zinc-300",
      )}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[1.125rem]" />
    </SwitchPrimitive.Root>
  );
}
