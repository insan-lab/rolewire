"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { changePasswordAction } from "@/lib/actions";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation";

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: "", new_password: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    const result = await changePasswordAction({
      current_password: values.current_password ?? "",
      new_password: values.new_password,
    });
    if (!result.ok) {
      toast.error("Couldn't change password", result.error);
      return;
    }
    toast.success("Password updated");
    reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      {!hasPassword ? (
        <Callout tone="neutral">
          You signed up with a social provider. Setting a password below adds email/password as an
          extra way to sign in.
        </Callout>
      ) : null}

      {hasPassword ? (
        <Field label="Current password" htmlFor="current_password" error={errors.current_password?.message}>
          <Input
            id="current_password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.current_password)}
            {...register("current_password")}
          />
        </Field>
      ) : null}

      <Field label="New password" htmlFor="new_password" error={errors.new_password?.message}>
        <Input
          id="new_password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.new_password)}
          {...register("new_password")}
        />
      </Field>

      <Button type="submit" size="sm" loading={isSubmitting}>
        {hasPassword ? "Update password" : "Set password"}
      </Button>
    </form>
  );
}
