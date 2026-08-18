/** Exchange email + password for a session cookie pair. */
import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { request } from "@/lib/api/fetch";
import { writeSession } from "@/lib/api/server";
import type { TokenPair } from "@/lib/api/types";
import { loginSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const tokens = await request<TokenPair>("/v1/admin/auth/login", {
      method: "POST",
      body: parsed.data,
    });
    await writeSession(tokens);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) {
      const headers = error.retryAfter ? { "retry-after": String(error.retryAfter) } : undefined;
      return NextResponse.json({ detail: error.message }, { status: error.status, headers });
    }
    throw error;
  }
}
