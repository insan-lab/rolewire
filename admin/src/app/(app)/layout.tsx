import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MobileNav, Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { requireUser } from "@/lib/api/server";
import { PUBLIC_API_URL } from "@/lib/env";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Authenticated shell. Middleware already refreshed or rejected the session before this renders,
 * so `requireUser` is a cheap confirmation rather than the real gate.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh bg-ink">
      <Sidebar userEmail={user.email} role={user.role} companyName={user.company_name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} docsUrl={`${PUBLIC_API_URL}/docs`} />
        <MobileNav />
        <main id="main" className="flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
