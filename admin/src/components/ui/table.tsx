import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** Dense data table (frontend spec §7): tight rows, sticky header, no zebra striping. */
export function Table({
  children,
  className,
  caption,
}: {
  children: ReactNode;
  className?: string;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "sticky top-0 z-10 border-b border-[var(--line-soft)] bg-[var(--ink-soft)] px-3 py-2 text-left font-mono text-xs font-semibold uppercase tracking-wide text-dim",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("border-b border-[var(--line-soft)] px-3 py-2 align-middle text-dim", className)} {...props}>
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      className={cn(onClick && "cursor-pointer hover:bg-[var(--ink-soft)] hover:text-paper transition-colors", className)}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function Pagination({
  total,
  limit,
  offset,
  buildHref,
}: {
  total: number;
  limit: number;
  offset: number;
  buildHref: (offset: number) => string;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const hasPrev = offset > 0;
  const hasNext = to < total;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--line-soft)] px-3 py-2 font-mono text-xs text-dim">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <PageLink href={buildHref(Math.max(0, offset - limit))} disabled={!hasPrev}>
          Previous
        </PageLink>
        <PageLink href={buildHref(offset + limit)} disabled={!hasNext}>
          Next
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span aria-disabled className="rounded border border-[var(--line-soft)] px-2 py-1 text-dim opacity-40">
        {children}
      </span>
    );
  }
  return (
    <a href={href} className="rounded border border-[var(--line-soft)] px-2 py-1 text-dim transition-colors hover:bg-[var(--ink-soft)] hover:text-paper">
      {children}
    </a>
  );
}

