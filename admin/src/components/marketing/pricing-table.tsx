import { Check, Minus } from "lucide-react";
import Link from "next/link";

import { PLANS, REGION_COPY, priceFor, type Region } from "@/lib/plans";

/**
 * Shared body of /pricing and /pricing/bd. The two regions are separate routes rather than a
 * toggle, so each is linkable and indexable — and so nobody is silently redirected between them.
 */
export function PricingTable({ region }: { region: Region }) {
  const copy = REGION_COPY[region];
  const symbol = region === "bd" ? "৳" : "$";
  const other = region === "bd" ? { href: "/pricing", label: "Paying outside Bangladesh?" } : { href: "/pricing/bd", label: "Paying from Bangladesh?" };

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Pricing {region === "bd" ? "in Bangladesh" : ""}
          </h1>
          <p className="prose-plain mt-2 max-w-2xl">
            One flat price per company. Unlimited job posts, unlimited applications, and your own
            storage on every plan.
          </p>
        </div>
        <Link href={other.href} className="text-sm font-medium text-accent-700 hover:underline">
          {other.label}
        </Link>
      </div>

      <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
        Billed in {copy.currency} through {copy.provider}. {copy.note}
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {PLANS.map((plan) => {
          const monthly = priceFor(plan, region, "monthly");
          const yearly = priceFor(plan, region, "yearly");
          return (
            <section
              key={plan.name}
              className={`rounded-lg border bg-white p-6 shadow-card ${
                plan.highlighted ? "border-accent-300 ring-1 ring-accent-200" : "border-zinc-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-zinc-900">{plan.title}</h2>
                {plan.highlighted ? (
                  <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700 ring-1 ring-inset ring-accent-200">
                    Most complete
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-zinc-600">{plan.tagline}</p>

              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight text-zinc-900">
                  {symbol}
                  {monthly}
                </span>
                <span className="text-sm text-zinc-500">/month</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                or {symbol}
                {yearly} a year — two months off
              </p>

              <ul className="mt-5 space-y-2 text-sm text-zinc-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <span>{feature}</span>
                  </li>
                ))}
                {plan.limits.map((limit) => (
                  <li key={limit} className="flex gap-2 text-zinc-500">
                    <Minus aria-hidden className="mt-0.5 size-4 shrink-0 text-zinc-400" />
                    <span>{limit}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-6 inline-flex h-9 w-full items-center justify-center rounded-md text-sm font-medium ${
                  plan.highlighted
                    ? "bg-accent-600 text-white hover:bg-accent-700"
                    : "border border-zinc-300 text-zinc-800 hover:bg-zinc-50"
                }`}
              >
                Start with {plan.title}
              </Link>
            </section>
          );
        })}
      </div>

      <div className="mt-10 grid gap-6 text-sm md:grid-cols-2">
        <Faq
          question="Is there a free trial?"
          answer="You can create an account, build jobs and inspect the public API response before paying. Publishing and collecting live applications needs an active plan."
        />
        <Faq
          question="What counts against hosted storage?"
          answer="Only files uploaded to Rolewire-hosted storage. If you connect your own S3, Drive or Telegram destination, the files never touch our storage and never appear on your usage."
        />
        <Faq
          question="Can I switch storage later?"
          answer="Yes, per job. Existing applications keep pointing at wherever their file was stored at the time."
        />
        <Faq
          question={region === "bd" ? "How do renewals work with bKash?" : "Who is the merchant of record?"}
          answer={
            region === "bd"
              ? "UddoktaPay charges are one-off, so we email you before the period ends and the subscription enters a short grace period if a renewal is missed."
              : "Paddle. They handle VAT/GST, invoicing and card details; Rolewire never sees your card."
          }
        />
      </div>
    </div>
  );
}

function Faq({ question, answer }: { question: string; answer: string }) {
  return (
    <div>
      <h3 className="font-medium text-zinc-900">{question}</h3>
      <p className="mt-1 leading-relaxed text-zinc-600">{answer}</p>
    </div>
  );
}
