"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { appPost } from "@/lib/api/browser";
import { userFacingMessage } from "@/lib/api/errors";
import { slugifyFieldKey } from "@/lib/utils";
import { signupSchema, type SignupInput } from "@/lib/validation";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", company_name: "", slug: "" },
  });

  const companyName = watch("company_name");

  /** Suggest a slug from the company name until the user edits it themselves. */
  function suggestSlug(value: string) {
    if (slugTouched) return;
    const suggestion = slugifyFieldKey(value).replace(/_/g, "-").replace(/^q-/, "");
    setValue("slug", suggestion.length >= 2 ? suggestion.slice(0, 63) : "");
  }

  async function onSubmit(values: SignupInput) {
    setError(null);
    try {
      await appPost("/api/auth/signup", values);
      window.location.assign("/dashboard?welcome=1");
    } catch (caught) {
      setError(userFacingMessage(caught));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error ? <Callout tone="danger">{error}</Callout> : null}

      <Field label="Company name" htmlFor="company_name" error={errors.company_name?.message}>
        <Input
          id="company_name"
          autoComplete="organization"
          autoFocus
          aria-invalid={Boolean(errors.company_name)}
          {...register("company_name", {
            onChange: (event) => suggestSlug(event.target.value),
          })}
        />
      </Field>

      <Field
        label="Career page slug"
        htmlFor="slug"
        optional
        error={errors.slug?.message}
        hint={
          <>
            Used for stable listing URLs: <code className="font-mono">/v1/public/jobs?slug=…</code>.
            Leave blank and we derive one from {companyName ? `"${companyName}"` : "your company name"}.
          </>
        }
      >
        <Input
          id="slug"
          spellCheck={false}
          aria-invalid={Boolean(errors.slug)}
          {...register("slug", { onChange: () => setSlugTouched(true) })}
        />
      </Field>

      <Field label="Work email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
        hint="At least 8 characters. Longer beats complicated."
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
      </Field>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Create account
      </Button>
    </form>
  );
}
