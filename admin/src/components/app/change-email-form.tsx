"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { changeEmailAction } from "@/lib/actions";
import { changeEmailSchema, type ChangeEmailInput } from "@/lib/validation";

export function ChangeEmailForm({ emailVerified }: { emailVerified: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { new_email: "", current_password: "" },
  });

  if (!emailVerified) {
    return (
      <Callout tone="warning">
        Verify your current email before you can change it. Contact support if you need a
        verification link resent.
      </Callout>
    );
  }

  async function onSubmit(values: ChangeEmailInput) {
    const result = await changeEmailAction(values);
    if (!result.ok) {
      toast.error("Couldn't change email", result.error);
      return;
    }
    toast.success("Email updated", "Your new address is unverified until you confirm it.");
    reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <Field label="New email" htmlFor="new_email" error={errors.new_email?.message}>
        <Input
          id="new_email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.new_email)}
          {...register("new_email")}
        />
      </Field>

      <Field label="Current password" htmlFor="email_current_password" error={errors.current_password?.message}>
        <Input
          id="email_current_password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.current_password)}
          {...register("current_password")}
        />
      </Field>

      <Button type="submit" size="sm" loading={isSubmitting}>
        Update email
      </Button>
    </form>
  );
}
