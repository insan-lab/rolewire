"use client";

import { RotateCw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Root error boundary. Deliberately vague about internals — the message shown to a tenant admin
 * should not leak stack traces or upstream error text.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("unhandled admin panel error", error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="text-xl font-semibold text-zinc-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-600">
        The page could not be loaded. If this keeps happening, the API may be unavailable — check
        the service status before retrying.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-zinc-400">reference: {error.digest}</p>
      ) : null}
      <div className="mt-6">
        <Button onClick={reset} icon={<RotateCw className="size-4" />}>
          Try again
        </Button>
      </div>
    </main>
  );
}
