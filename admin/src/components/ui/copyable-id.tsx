"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function CopyableId({
  id,
  label,
  className,
  truncate = false,
}: {
  id: string;
  label?: string;
  className?: string;
  truncate?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback if clipboard fails in unsecure contexts
    }
  }

  const displayText = truncate && id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <code
        className="rounded border border-[var(--line-soft)] bg-[var(--ink)] px-1.5 py-0.5 font-mono text-[0.7rem] text-dim select-all"
        title={id}
      >
        {displayText}
      </code>
      <button
        type="button"
        onClick={copy}
        title={label ? `Copy ${label}` : `Copy ${id}`}
        aria-label={label ? `Copy ${label}` : `Copy ${id}`}
        className="rounded p-0.5 text-dim transition-colors hover:bg-[var(--ink-soft)] hover:text-paper"
      >
        {copied ? (
          <Check className="size-3 text-[var(--signal)]" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </span>
  );
}
