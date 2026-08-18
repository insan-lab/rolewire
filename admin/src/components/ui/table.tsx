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
        "sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500",
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
    <td className={cn("border-b border-zinc-100 px-3 py-2 align-middle text-zinc-700", className)} {...props}>
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
      className={cn(onClick && "cursor-pointer hover:bg-accent-50/60", className)}
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
    <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500">
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
      <span aria-disabled className="rounded border border-zinc-200 px-2 py-1 text-zinc-300">
        {children}
      </span>
    );
  }
  return (
    <a href={href} className="rounded border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-50">
      {children}
    </a>
  );
}
