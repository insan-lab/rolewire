"use client";

import { useState } from "react";
import { Copy, Check, Eye, X, Mail } from "lucide-react";

import type { PlatformContactSubmission } from "@/lib/api/types";
import { formatDate } from "@/lib/utils";
import { ContactSubmissionStatusSelect } from "./contact-submission-status-select";

export function ContactSubmissionRow({ submission }: { submission: PlatformContactSubmission }) {
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);

  function copyId() {
    navigator.clipboard.writeText(submission.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shortUuid = submission.id.slice(0, 8);

  return (
    <>
      <tr className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
        <td className="p-3 text-xs">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-paper">
            <span
              className="rounded bg-[var(--ink-soft)] px-1.5 py-0.5 border border-[var(--line-soft)] cursor-pointer hover:border-copper-bright transition-colors"
              title={`Full UUID: ${submission.id} (Click to copy)`}
              onClick={copyId}
            >
              {shortUuid}…
            </span>
            <button
              type="button"
              onClick={copyId}
              className="text-dim hover:text-paper p-0.5 rounded transition-colors"
              title="Copy full UUID"
            >
              {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
            </button>
          </div>
        </td>
        <td className="p-3">
          <p className="font-medium text-sm text-paper">{submission.name}</p>
          <a
            href={`mailto:${submission.email}`}
            className="text-xs text-copper-bright hover:underline"
          >
            {submission.email}
          </a>
        </td>
        <td className="p-3">
          <div className="max-w-xs truncate text-xs text-dim" title={submission.message}>
            {submission.message}
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-copper-bright hover:underline"
          >
            <Eye className="size-3" /> View full message
          </button>
        </td>
        <td className="p-3">
          <ContactSubmissionStatusSelect
            submissionId={submission.id}
            currentStatus={submission.status}
          />
        </td>
        <td className="p-3 text-right text-xs text-dim">
          {formatDate(submission.created_at)}
        </td>
      </tr>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[var(--line-soft)] bg-[var(--ink)] p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--line-soft)] pb-4">
              <div>
                <h3 className="text-lg font-semibold text-paper flex items-center gap-2">
                  <Mail className="size-5 text-copper-bright" /> Contact Inquiry
                </h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-xs text-dim">ID: {submission.id}</span>
                  <button
                    type="button"
                    onClick={copyId}
                    className="text-dim hover:text-paper text-xs inline-flex items-center gap-1"
                  >
                    {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    {copied ? "Copied" : "Copy UUID"}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 text-dim hover:bg-[var(--ink-soft)] hover:text-paper"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <span className="text-xs font-medium text-dim uppercase tracking-wider">From</span>
                <p className="text-sm font-medium text-paper">{submission.name}</p>
                <a href={`mailto:${submission.email}`} className="text-xs text-copper-bright hover:underline">
                  {submission.email}
                </a>
              </div>

              <div>
                <span className="text-xs font-medium text-dim uppercase tracking-wider">Status</span>
                <div className="mt-1">
                  <ContactSubmissionStatusSelect
                    submissionId={submission.id}
                    currentStatus={submission.status}
                  />
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-dim uppercase tracking-wider">Submitted At</span>
                <p className="text-xs text-dim">{new Date(submission.created_at).toLocaleString()}</p>
              </div>

              <div>
                <span className="text-xs font-medium text-dim uppercase tracking-wider">Message</span>
                <div className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--line-soft)] bg-[var(--ink-soft)] p-3 text-sm text-paper">
                  {submission.message}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-md bg-[var(--ink-soft)] px-4 py-2 text-xs font-medium text-paper hover:bg-[rgba(255,255,255,0.08)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
