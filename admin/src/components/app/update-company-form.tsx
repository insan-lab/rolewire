"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { updateCompanyAction } from "@/lib/actions";
import { updateCompanySchema, type UpdateCompanyInput } from "@/lib/validation";

export function UpdateCompanyForm({
  companyName,
  companySlug,
}: {
  companyName: string;
  companySlug: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCompanyInput>({
    resolver: zodResolver(updateCompanySchema),
    defaultValues: { company_name: companyName, company_slug: companySlug ?? "" },
  });

  async function onSubmit(values: UpdateCompanyInput) {
    const result = await updateCompanyAction({
      company_name: values.company_name,
      company_slug: values.company_slug ? values.company_slug : undefined,
    });
    if (!result.ok) {
      toast.error("Couldn't update company", result.error);
      return;
    }
    toast.success("Company updated");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <Field label="Company name" htmlFor="company_name" error={errors.company_name?.message}>
        <Input id="company_name" aria-invalid={Boolean(errors.company_name)} {...register("company_name")} />
      </Field>

      <Field
        label="Career page slug"
        htmlFor="company_slug"
        error={errors.company_slug?.message}
        hint="Used for stable listing URLs. Changing it breaks any links already shared with your old slug."
      >
        <Input id="company_slug" aria-invalid={Boolean(errors.company_slug)} {...register("company_slug")} />
      </Field>

      <Button type="submit" size="sm" loading={isSubmitting}>
        Save company
      </Button>
    </form>
  );
}
