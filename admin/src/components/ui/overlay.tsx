"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const OVERLAY =
  "fixed inset-0 z-40 bg-zinc-900/25 data-[state=open]:animate-fade-in";

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
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white shadow-overlay data-[state=open]:animate-slide-up">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-4 py-3">
            <div className="space-y-1">
              <DialogPrimitive.Title className="text-sm font-semibold text-zinc-900">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-xs text-zinc-500">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {children ? <div className="px-4 py-3 text-sm text-zinc-700">{children}</div> : null}
          {footer ? (
            <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">{footer}</div>
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
        <DialogPrimitive.Content className="fixed right-0 top-0 z-50 flex h-full w-[min(34rem,100vw)] flex-col border-l border-zinc-200 bg-white shadow-overlay data-[state=open]:animate-slide-in-right">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-4 py-3">
            <div className="min-w-0 space-y-1">
              <DialogPrimitive.Title className="truncate text-sm font-semibold text-zinc-900">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-xs text-zinc-500">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">{footer}</div>
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
          className="z-50 min-w-44 rounded-md border border-zinc-200 bg-white p-1 shadow-overlay data-[state=open]:animate-slide-up"
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
        "flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none",
        destructive ? "text-red-700 data-[highlighted]:bg-red-50" : "text-zinc-700 data-[highlighted]:bg-zinc-100",
        "data-[disabled]:cursor-not-allowed data-[disabled]:text-zinc-400",
      )}
    >
      {children}
    </DropdownPrimitive.Item>
  );
}

export const DropdownSeparator = () => (
  <DropdownPrimitive.Separator className="my-1 h-px bg-zinc-200" />
);
