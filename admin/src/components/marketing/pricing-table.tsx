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
          <h1 className="font-display text-2xl font-semibold tracking-tight text-paper">
            Pricing {region === "bd" ? "in Bangladesh" : ""}
          </h1>
          <p className="prose-plain mt-2 max-w-2xl">
            One flat price per company. Unlimited job posts, unlimited applications, and your own
            storage on every plan.
          </p>
        </div>
        <Link href={other.href} className="font-mono text-sm text-copper-bright hover:underline">
          {other.label}
        </Link>
      </div>

      <p
        className="mt-4 rounded-md border px-3 py-2 text-sm text-dim"
        style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
      >
        Billed in {copy.currency} through {copy.provider}. {copy.note}
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {PLANS.map((plan) => {
          const monthly = priceFor(plan, region, "monthly");
          const yearly = priceFor(plan, region, "yearly");
          return (
            <section
              key={plan.name}
              className="rounded-lg border p-6"
              style={{
                background: "var(--ink-soft)",
                borderColor: plan.highlighted ? "var(--copper)" : "var(--line-soft)",
                boxShadow: plan.highlighted ? "0 0 0 1px var(--copper)" : undefined,
              }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-paper">{plan.title}</h2>
                {plan.highlighted ? (
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-xs font-medium ring-1 ring-inset"
                    style={{
                      background: "rgba(192,122,62,0.15)",
                      color: "var(--copper-bright)",
                      ringColor: "var(--copper)",
                    }}
                  >
                    Most complete
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-dim">{plan.tagline}</p>

              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight text-paper">
                  {symbol}
                  {monthly}
                </span>
                <span className="text-sm text-dim">/month</span>
              </p>
              <p className="mt-1 font-mono text-xs text-dim">
                or {symbol}
                {yearly} a year — two months off
              </p>

              <ul className="mt-5 space-y-2 text-sm text-dim">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-signal" />
                    <span className="text-paper">{feature}</span>
                  </li>
                ))}
                {plan.limits.map((limit) => (
                  <li key={limit} className="flex gap-2 text-dim">
                    <Minus aria-hidden className="mt-0.5 size-4 shrink-0 text-dim" />
                    <span>{limit}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md text-sm font-medium transition-colors hover:opacity-90"
                style={
                  plan.highlighted
                    ? { backgroundColor: "var(--copper-bright)", color: "var(--ink)" }
                    : { border: "1px solid var(--line-soft)", color: "var(--text-dim)" }
                }
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
      <h3 className="font-medium text-paper">{question}</h3>
      <p className="mt-1 leading-relaxed text-dim">{answer}</p>
    </div>
  );
}
