"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

type ToastMessage = {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  toast: (message: Omit<ToastMessage, "id">) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="size-4 text-emerald-600" />,
  error: <AlertTriangle className="size-4 text-red-600" />,
  info: <Info className="size-4 text-accent-600" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const toast = useCallback((message: Omit<ToastMessage, "id">) => {
    setMessages((current) => [...current, { ...message, id: Date.now() + Math.random() }]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, body) => toast({ title, body, tone: "success" }),
      error: (title, body) => toast({ title, body, tone: "error" }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={6000}>
        {children}
        {messages.map((message) => (
          <ToastPrimitive.Root
            key={message.id}
            onOpenChange={(open) => {
              if (!open) setMessages((current) => current.filter((item) => item.id !== message.id));
            }}
            className={cn(
              "flex items-start gap-2.5 rounded-md border bg-[var(--ink-soft)] px-3 py-2.5 shadow-overlay data-[state=open]:animate-slide-up",
              message.tone === "error" ? "border-red-500/30" : "border-[var(--line-soft)]",
            )}
          >
            <span className="mt-0.5">{ICONS[message.tone]}</span>
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-sm font-medium text-paper">
                {message.title}
              </ToastPrimitive.Title>
              {message.body ? (
                <ToastPrimitive.Description className="mt-0.5 text-xs text-dim">
                  {message.body}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="rounded px-1 text-xs text-dim hover:text-paper"
            >
              ✕
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
