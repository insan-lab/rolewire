"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Header links that depend on whether the visitor already has a session.
 *
 * Fetched client-side on purpose: reading the cookie during render would opt the whole marketing
 * layout out of static generation. Until the check resolves, the anonymous links render — which is
 * the correct default for a cold, uncached visit.
 */
export function SessionLinks() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { signal: controller.signal, credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : { signed_in: false }))
      .then((data: { signed_in?: boolean }) => setSignedIn(Boolean(data.signed_in)))
      .catch(() => setSignedIn(false));
    return () => controller.abort();
  }, []);

  if (signedIn) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/dashboard"
          className="rounded-md px-3 py-1.5 font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: "var(--copper-bright)", color: "var(--ink)" }}
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href="/login"
        className="px-2 py-1.5 text-dim transition-colors hover:text-paper"
      >
        Log in
      </Link>
      <Link
        href="/signup"
        className="rounded-md px-3 py-1.5 font-medium transition-colors hover:opacity-90"
        style={{ backgroundColor: "var(--copper-bright)", color: "var(--ink)" }}
      >
        Start free
      </Link>
    </div>
  );
}
