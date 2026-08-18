/**
 * Drop the session cookies.
 *
 * The backend has no refresh-token revocation endpoint (backend spec v0.1 keeps refresh tokens
 * stateless), so logout is a client-side session drop: the cookies are deleted and the tokens are
 * left to expire. Worth revisiting if server-side revocation is added.
 */
import { NextResponse } from "next/server";

import { clearSession } from "@/lib/api/server";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
