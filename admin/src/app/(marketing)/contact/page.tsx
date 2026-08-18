import type { Metadata } from "next";

import { ContactForm } from "@/components/marketing/contact-form";
import { SUPPORT_EMAIL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Contact",
  description: "Ask a question about Rolewire — API details, storage options, billing or migration.",
};

export const revalidate = 3600;

export default function ContactPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-5 py-14 lg:grid-cols-[1fr_1fr]">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-paper">
          Contact us
        </h1>
        <div className="prose-plain mt-4 space-y-4">
          <p>
            Questions about the API, storage destinations, billing in your country, or moving off
            another tool? Send a note and a person will answer — usually within one business day.
          </p>
          <p>
            If you would rather not use a form, write directly to{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-copper-bright hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <p className="text-sm">
            Already a customer with an urgent problem? Include your company name so we can find your
            account quickly.
          </p>
        </div>
      </div>

      <div
        className="rounded-lg border p-5 shadow-card"
        style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
      >
        <ContactForm />
      </div>
    </div>
  );
}
