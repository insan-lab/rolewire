"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Read-only JSON/code display with a copy button. Used for the public-API preview in the job
 * wizard (frontend spec §6.1 step 4) and the hero snippet on the landing page.
 */
export function CodeBlock({
  code,
  label,
  className,
  maxHeight = "24rem",
}: {
  code: string;
  label?: string;
  className?: string;
  maxHeight?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is unavailable (insecure context); the code is selectable either way.
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-1.5">
        <span className="font-mono text-xs text-zinc-400">{label ?? "json"}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="overflow-auto px-3 py-3 font-mono text-xs leading-relaxed text-zinc-100"
        style={{ maxHeight }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
