/** Create a tenant plus its first admin user, then start a session. */
import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { request } from "@/lib/api/fetch";
import { writeSession } from "@/lib/api/server";
import type { TokenPair } from "@/lib/api/types";
import { signupSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const parsed = signupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { slug, ...rest } = parsed.data;
  try {
    const tokens = await request<TokenPair>("/v1/admin/auth/signup", {
      method: "POST",
      // The backend derives a slug from the company name when none is supplied.
      body: slug ? { ...rest, slug } : rest,
    });
    await writeSession(tokens);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
