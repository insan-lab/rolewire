import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PlatformSidebar } from "@/components/platform/sidebar";
import { requirePlatformAdmin } from "@/lib/api/platform-server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Authenticated shell for the platform-superadmin surface. Middleware already refreshed or
 * rejected the session before this renders; requirePlatformAdmin is a cheap confirmation.
 */
export default async function PlatformDashboardLayout({ children }: { children: ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="flex min-h-dvh bg-ink">
      <PlatformSidebar adminEmail={admin.email} />
      <main id="main" className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
