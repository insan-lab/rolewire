/**
 * Minimal session probe for the marketing header. Returns only a boolean — never the token, the
 * email, or anything else that would widen what an XSS could read.
 */
import { NextResponse } from "next/server";

import { isSignedIn } from "@/lib/api/server";

export async function GET() {
  return NextResponse.json(
    { signed_in: await isSignedIn() },
    { headers: { "cache-control": "no-store" } },
  );
}
