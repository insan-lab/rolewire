/**
 * Marketing-side plan catalog.
 *
 * The API's plan list (`GET /v1/admin/billing/plans`) is authenticated, and the backend exposes no
 * public pricing endpoint, so the marketing pages cannot read prices from it. This file mirrors the
 * seeded plans in `api/app/cli.py` (`DEFAULT_PLANS`) and is the one place to update when pricing
 * changes. A small public `/v1/public/plans` endpoint would remove the duplication — worth adding
 * to the backend later.
 */

export type PlanCopy = {
  name: string;
  title: string;
  tagline: string;
  usd: { monthly: number; yearly: number };
  bdt: { monthly: number; yearly: number };
  features: string[];
  limits: string[];
  highlighted?: boolean;
};

export const PLANS: PlanCopy[] = [
  {
    name: "basic",
    title: "Basic",
    tagline: "Post jobs, collect applications, keep files in your own storage.",
    usd: { monthly: 9, yearly: 90 },
    bdt: { monthly: 990, yearly: 9900 },
    features: [
      "Unlimited job posts and applications",
      "Bring your own storage: S3, Google Drive or Telegram",
      "1 GB of Rolewire-hosted storage included",
      "ATS webhook forwarding for every application",
      "Custom application questions with typed answers",
    ],
    limits: ["No applicant email sending", "No hosted OpenCATS"],
  },
  {
    name: "pro",
    title: "Pro",
    tagline: "Adds applicant email and a hosted ATS on top of everything in Basic.",
    usd: { monthly: 14, yearly: 140 },
    bdt: { monthly: 1490, yearly: 14900 },
    features: [
      "Everything in Basic",
      "Applicant confirmation emails sent for you",
      "10 GB of Rolewire-hosted storage included",
      "Hosted OpenCATS instance when it ships",
      "Priority support",
    ],
    limits: [],
    highlighted: true,
  },
];

export type Region = "global" | "bd";

export const REGION_COPY: Record<Region, { currency: string; provider: string; note: string }> = {
  global: {
    currency: "USD",
    provider: "Paddle",
    note: "Card and PayPal via Paddle, which acts as merchant of record and handles VAT/GST.",
  },
  bd: {
    currency: "BDT",
    provider: "UddoktaPay",
    note: "bKash, Nagad and card payments via UddoktaPay. Renewals are charged manually each cycle — we email you before it lapses.",
  },
};

export function priceFor(plan: PlanCopy, region: Region, cycle: "monthly" | "yearly"): number {
  return region === "bd" ? plan.bdt[cycle] : plan.usd[cycle];
}

/**
 * Soft region guess used only to pick which pricing link to surface first. Never redirects —
 * matching the backend's rule that provider choice comes from the checkout the user enters.
 */
export function guessRegion(acceptLanguage: string | null): Region {
  if (!acceptLanguage) return "global";
  return /\bbn\b|-BD\b/i.test(acceptLanguage) ? "bd" : "global";
}
