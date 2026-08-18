import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Application } from "@/lib/api/types";

/** Tailwind-aware class merge, so component-level classes can override defaults predictably. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** `Senior Backend Engineer` → `senior_backend_engineer`, matching the backend's field_key rules. */
export function slugifyFieldKey(label: string): string {
  const base = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 63);
  // field_key must start with a letter (backend pattern ^[a-z][a-z0-9_]{0,62}$).
  return /^[a-z]/.test(base) ? base : `q_${base}`.slice(0, 63);
}

/** Make a field key unique against keys already in the set: resume → resume_2. */
export function uniqueFieldKey(candidate: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(candidate)) return candidate;
  for (let index = 2; index < 1000; index += 1) {
    const suffix = `_${index}`;
    const next = `${candidate.slice(0, 63 - suffix.length)}${suffix}`;
    if (!used.has(next)) return next;
  }
  return candidate;
}

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_ONLY = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Backend timestamps are UTC; SQLite-backed dev responses may omit the offset, so normalize. */
function parseUtc(value: string): Date {
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return DATE_TIME.format(parseUtc(value));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return DATE_ONLY.format(parseUtc(value));
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const seconds = (Date.now() - parseUtc(value).getTime()) / 1000;
  if (seconds < 60) return "just now";
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86400],
    ["month", 2_592_000],
    ["year", 31_536_000],
  ];
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0]!;
  for (const unit of units) {
    if (seconds >= unit[1]) chosen = unit;
  }
  return formatter.format(-Math.round(seconds / chosen[1]), chosen[0]);
}

export function formatMoney(amount: string | number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function formatBytesFromMb(megabytes: number): string {
  if (megabytes < 1024) return `${megabytes.toFixed(megabytes < 10 ? 1 : 0)} MB`;
  return `${(megabytes / 1024).toFixed(2)} GB`;
}

/** Compact plural helper: pluralize(1, "application") → "1 application". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Applicant-identifying answer, best-effort: the question set is tenant-defined. */
export function applicantLabel(application: Application): string {
  const answers = application.answers as Record<string, unknown>;
  for (const key of ["full_name", "name", "first_name", "applicant_name"]) {
    const value = answers[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return application.applicant_email ?? "Applicant";
}
