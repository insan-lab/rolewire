/**
 * Contact form → support inbox, sent through Brevo (frontend spec §3.2).
 *
 * Brevo is called from this route handler rather than the API because the backend exposes no
 * contact endpoint — outbound transactional mail there is applicant receipts only. The API key is
 * server-only and never reaches the browser.
 */
import { NextResponse, type NextRequest } from "next/server";

import { contactSchema } from "@/lib/validation";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/**
 * Coarse in-memory throttle: enough to stop a bored bot, not a substitute for a real limiter.
 * Per-instance only, so it resets on deploy and does not coordinate across replicas — acceptable
 * for a contact form, and worth moving to Redis if this page ever gets abused seriously.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const hits = new Map<string, number[]>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear(); // crude cap so a hostile client cannot grow this unbounded
  return recent.length > MAX_PER_WINDOW;
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: NextRequest) {
  const parsed = contactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  if (throttled(clientIp(request))) {
    return NextResponse.json(
      { detail: "Too many messages from this connection. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const apiKey = process.env.BREVO_API_KEY;
  const inbox = process.env.SUPPORT_INBOX_EMAIL;
  const sender = process.env.BREVO_SENDER_EMAIL ?? inbox;

  if (!apiKey || !inbox || !sender) {
    // Fail loudly in the server log, politely in the UI: the page also shows a mailto fallback.
    console.error("contact form is not configured (BREVO_API_KEY / SUPPORT_INBOX_EMAIL missing)");
    return NextResponse.json(
      { detail: "The contact form is not available right now — please email us directly." },
      { status: 503 },
    );
  }

  const { name, email, message } = parsed.data;

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { email: sender, name: "Rolewire website" },
        to: [{ email: inbox }],
        // Replies go to the person who wrote in, not to the sending identity.
        replyTo: { email, name },
        subject: `Contact form: ${name}`,
        htmlContent: `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
        textContent: `${name} <${email}>\n\n${message}`,
      }),
    });

    if (!response.ok) {
      console.error("brevo rejected the contact message", response.status, await response.text());
      return NextResponse.json(
        { detail: "We could not send that message. Please email us directly." },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("brevo request failed", error);
    return NextResponse.json(
      { detail: "We could not send that message. Please email us directly." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
