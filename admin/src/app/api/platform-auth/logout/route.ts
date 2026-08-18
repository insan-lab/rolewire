/** Drop the platform-admin session cookies. See app/api/auth/logout for the tenant equivalent. */
import { NextResponse } from "next/server";

import { clearPlatformSession } from "@/lib/api/platform-server";

export async function POST() {
  await clearPlatformSession();
  return NextResponse.json({ ok: true });
}
