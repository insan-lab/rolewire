"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { appPost } from "@/lib/api/browser";
import { userFacingMessage } from "@/lib/api/errors";
import { contactSchema, type ContactInput } from "@/lib/validation";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", message: "" },
  });

  async function onSubmit(values: ContactInput) {
    setError(null);
    try {
      await appPost("/api/contact", values);
      setSent(true);
    } catch (caught) {
      setError(userFacingMessage(caught));
    }
  }

  if (sent) {
    return (
      <Callout tone="success" title="Message sent">
        We have it. Expect a reply to the address you gave, usually within one business day.
      </Callout>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error ? <Callout tone="danger">{error}</Callout> : null}

      <Field label="Your name" htmlFor="contact-name" error={errors.name?.message}>
        <Input
          id="contact-name"
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
      </Field>

      <Field label="Email" htmlFor="contact-email" error={errors.email?.message}>
        <Input
          id="contact-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </Field>

      <Field
        label="Message"
        htmlFor="contact-message"
        error={errors.message?.message}
        hint="What are you trying to do, and what is in the way?"
      >
        <Textarea
          id="contact-message"
          rows={6}
          aria-invalid={Boolean(errors.message)}
          {...register("message")}
        />
      </Field>

      <Button type="submit" loading={isSubmitting} icon={<Send className="size-4" />}>
        Send message
      </Button>
    </form>
  );
}
