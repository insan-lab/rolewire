"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const OVERLAY =
  "fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-fade-in";

/** Centered modal for short, focused confirmations and forms. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY} />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border shadow-overlay data-[state=open]:animate-slide-up"
          style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
        >
          <div
            className="flex items-start justify-between gap-4 border-b px-4 py-3"
            style={{ borderColor: "var(--line-soft)" }}
          >
            <div className="space-y-1">
              <DialogPrimitive.Title className="text-sm font-semibold text-paper">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-xs text-dim">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              className="rounded p-1 text-dim transition-colors hover:bg-[var(--ink)] hover:text-paper"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {children ? <div className="px-4 py-3 text-sm text-dim">{children}</div> : null}
          {footer ? (
            <div
              className="flex justify-end gap-2 border-t px-4 py-3"
              style={{ borderColor: "var(--line-soft)" }}
            >
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Right-hand drawer. Used for reading an application without losing the inbox list
 * (frontend spec §6.3).
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY} />
        <DialogPrimitive.Content
          className="fixed right-0 top-0 z-50 flex h-full w-[min(34rem,100vw)] flex-col border-l shadow-overlay data-[state=open]:animate-slide-in-right"
          style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
        >
          <div
            className="flex items-start justify-between gap-4 border-b px-4 py-3"
            style={{ borderColor: "var(--line-soft)" }}
          >
            <div className="min-w-0 space-y-1">
              <DialogPrimitive.Title className="truncate text-sm font-semibold text-paper">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-xs text-dim">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              className="rounded p-1 text-dim transition-colors hover:bg-[var(--ink)] hover:text-paper"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
          {footer ? (
            <div
              className="flex justify-end gap-2 border-t px-4 py-3"
              style={{ borderColor: "var(--line-soft)" }}
            >
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function DropdownMenu({
  trigger,
  children,
  align = "end",
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
}) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-44 rounded-md border p-1 shadow-overlay data-[state=open]:animate-slide-up"
          style={{ background: "var(--ink-soft)", borderColor: "var(--line-soft)" }}
        >
          {children}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}

export function DropdownItem({
  children,
  onSelect,
  destructive,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none transition-colors",
        destructive
          ? "text-red-400 data-[highlighted]:bg-red-500/10"
          : "text-dim data-[highlighted]:bg-[var(--ink)] data-[highlighted]:text-paper",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40",
      )}
    >
      {children}
    </DropdownPrimitive.Item>
  );
}

export const DropdownSeparator = () => (
  <DropdownPrimitive.Separator
    className="my-1 h-px"
    style={{ background: "var(--line-soft)" }}
  />
);
