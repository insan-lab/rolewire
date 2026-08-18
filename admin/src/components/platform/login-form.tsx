"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { appPost } from "@/lib/api/browser";
import { userFacingMessage } from "@/lib/api/errors";
import { loginSchema, type LoginInput } from "@/lib/validation";

export function PlatformLoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setError(null);
    try {
      await appPost("/api/platform-auth/login", values);
      window.location.assign(next && next.startsWith("/platform") ? next : "/platform");
    } catch (caught) {
      setError(userFacingMessage(caught));
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error ? <Callout tone="danger">{error}</Callout> : null}

      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
      </Field>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Log in
      </Button>
    </form>
  );
}
