# Rolewire — Frontend Specification (Admin Panel)

**Version:** 0.1 (Draft)
**Companion to:** `spec.md` (backend spec)
**Scope:** The Next.js admin panel only. Rolewire has no public-facing job-board UI — businesses build their own careers page against the public API described in `spec.md` §5.1.

---

## 1. Overview

The admin panel is where a tenant's team logs in, creates job posts with custom application questions, views incoming applications, configures storage destinations, and manages billing. It is the only first-party UI Rolewire ships — everything applicant-facing lives on the business's own site.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Server Components by default; Client Components only where interactivity requires it |
| Language | TypeScript, strict mode | Shared types generated from the FastAPI OpenAPI schema (see §8) |
| Styling | Tailwind CSS | Utility-first, no CSS-in-JS runtime overhead |
| Component primitives | shadcn/ui (Radix-based) | Accessible primitives (dialog, dropdown, tabs, toast) as a starting point, restyled per §9, not used as-is |
| Forms | React Hook Form + Zod | Zod schemas double as client-side validation and can mirror backend Pydantic schemas conceptually |
| Data fetching / cache | TanStack Query (React Query) | Client-side cache for admin API calls; used inside Client Components where Server Components + `fetch` aren't sufficient (mutations, polling applications inbox) |
| Server-state fetching | Next.js Server Components + native `fetch` with tags | Initial page loads (job list, application list) fetched server-side, revalidated via `revalidateTag` after mutations |
| Auth session | HttpOnly cookies for JWT access/refresh pair | No `localStorage` token storage (XSS exposure) — see §4 |
| Icons | lucide-react | Matches shadcn/ui's default icon set |
| Charts (billing usage, application volume) | Recharts | Lightweight, sufficient for a handful of usage graphs |
| Testing | Playwright (e2e), Vitest (unit) | E2E covers login, job creation, application view, billing upgrade flows |
| Containerization | Docker, multi-stage build (`deps` → `builder` → `runner`) | Standalone Next.js output mode for a minimal runtime image |

---

## 3. Route Map

```
/                          → public marketing landing page (see §3.1)
/pricing                   → public pricing page — global (Paddle) tiers by default
/pricing/bd                → public pricing page — Bangladesh (UddoktaPay/BDT) tiers
/about                     → company/product story — who's behind Rolewire, why headless
/contact                   → contact form (routes to support inbox) + direct support email/socials

/login                     → email+password login, OAuth buttons (Google/Facebook/GitHub/LinkedIn)
/signup                    → tenant + first admin user creation, OAuth buttons
/auth/oauth/callback       → transient route: backend redirects here post-OAuth, sets session, redirects to /dashboard
/auth/verify-email         → email verification landing (from SMTP-sent link)

/dashboard                 → overview: active jobs, recent applications, plan usage summary

/jobs                      → list of job posts (draft/published/closed), filter + search
/jobs/new                  → job creation wizard (details → questions → storage target → review)
/jobs/[jobId]              → job detail: edit fields, manage questions, view public API preview
/jobs/[jobId]/questions    → dedicated question-builder view (drag-to-reorder, add/edit/remove)
/jobs/[jobId]/applications → applications inbox scoped to this job

/applications              → all applications across all jobs, filterable by job/status/date
/applications/[id]         → single application detail (answers, resume link, forwarding status)

/settings/team             → invite/manage team members (admin/member roles)
/settings/storage          → connect/manage S3, Google Drive, Telegram storage targets
/settings/integrations     → ATS webhook URL config, hosted OpenCATS toggle (when available)
/settings/account          → linked OAuth providers, password change, email

/billing                   → current plan, usage this cycle, invoice history
/billing/upgrade           → plan comparison + Paddle checkout overlay (global) or UddoktaPay redirect (BD)
```

Route groups: `(marketing)` for `/`, `/pricing`, `/pricing/bd`, `/about`, `/contact` (public, no auth, fully static/SSG where possible for SEO); `(auth)` for `/login`, `/signup`, `/auth/*` (no sidebar shell); `(app)` for everything else (sidebar + topbar shell, requires session).

### 3.1 Landing page (`/`)

The one page in this app that *is* a marketing surface rather than an operational tool — the design-direction split in §7 applies here: `/` gets the deliberate, opinionated visual treatment; `(app)` stays quiet and dense.

**Sections (in order):**
1. **Hero** — states the core pitch plainly: headless job posting + application API, no forced UI, bring your own storage. A code/JSON snippet showing the actual `GET /v1/public/jobs/{id}` response (from backend spec §5.1) works better here than a generic product screenshot — it's the most characteristic artifact of what Rolewire actually is.
2. **How it works** — three-part flow: post a job in the panel → embed the API on your own career page → receive applications wherever you already store files (S3/Drive/Telegram/hosted). This is a real sequence, so numbered steps are earned here, unlike a decorative 01/02/03 elsewhere.
3. **Storage flexibility** — calls out the free bring-your-own-storage options explicitly; this is a genuine differentiator worth its own section, not a footnote.
4. **Pricing teaser** — plan names and price, linking to `/pricing` (or `/pricing/bd`) for the full breakdown; region shown is guessed softly from `Accept-Language`/geo but never auto-redirects silently, matching the region-resolution principle in the backend spec.
5. **CTA** — `/signup`, with OAuth buttons available immediately rather than gated behind a form.

**Auth-aware behavior:** a logged-in visitor hitting `/` gets a lightweight "Go to dashboard" affordance rather than being force-redirected away from the marketing page — someone might land on `/` from a shared link while already logged in and still want to see it.

**Rendering:** static-generated (SSG) or ISR with a long revalidate window, since content changes infrequently and this is the page most exposed to SEO/cold traffic — no reason to pay Server Component data-fetch cost on every load the way `/dashboard` does.

### 3.2 `/about` and `/contact`

Both static, low-priority pages relative to `/` and `/pricing`, but real search-entry and trust-signal surfaces worth having from day one rather than bolted on later:

- **`/about`** — short, plain account of what Rolewire is and why it's built headless/API-first, plus enough real information (team, location) to read as a legitimate business rather than a template SaaS — worth keeping honest and specific rather than generic "our mission" copy.
- **`/contact`** — a simple form (name, email, message) posting to a route handler that sends over SMTP to the support inbox (matches backend spec §11 — direct SMTP, no third-party ESP), plus a direct support email address shown in text for anyone who'd rather not use a form. No live chat widget for v0.1 — adds a third-party script dependency for a volume this stage doesn't need yet.

---

## 4. Auth Session Handling

**Storage:** JWT access token (short-lived, ~15 min) and refresh token (long-lived, ~30 days) are both set as `HttpOnly`, `Secure`, `SameSite=Lax` cookies by the FastAPI backend on login/OAuth callback — **never stored in `localStorage` or exposed to client JS.** This is the standard defense against XSS-driven token theft and is non-negotiable given the admin panel handles applicant PII.

**Session refresh:**
- A Next.js middleware (`middleware.ts`) runs on every request to `(app)` routes, checks access-token expiry (decoded, not verified, client-side — verification happens server-side on the actual API call), and silently calls `POST /v1/admin/auth/refresh` if the access token is within its last ~2 minutes of validity, before the request proceeds
- If the refresh token itself is expired/invalid, middleware redirects to `/login?reason=session_expired`

**Server Components calling the API:** forward the incoming request's cookies to the backend `fetch` call (Next.js `cookies()` helper) so server-rendered pages are authenticated on first paint — no client-side loading spinner just to discover you're logged in.

**OAuth flow (ties to backend spec §5.3):**
1. User clicks "Continue with Google" on `/login` → browser navigates directly to `GET {API_URL}/v1/admin/auth/oauth/google/start` (full page navigation, not a fetch — OAuth redirects require top-level navigation)
2. Backend handles the provider round-trip, sets session cookies on successful callback, redirects to `/dashboard`
3. `/auth/oauth/callback` in the route map above is a fallback error-display route for cases where the backend redirects back with an error query param (e.g., `?error=email_not_verified_by_provider`) rather than a normal success path — the happy path never actually renders this page, the backend redirects straight to `/dashboard`

**Linking additional providers from `/settings/account`:** same pattern, but the `/link` variant — full-page navigation to `{API_URL}/v1/admin/auth/oauth/{provider}/start?mode=link`, backend associates the new `oauth_accounts` row with the already-logged-in user via the session cookie rather than creating a new tenant.

---

## 5. State Management

No global client-state library (Redux/Zustand) for v0.1 — deliberately avoided because:
- Server Components + Server Actions handle most read paths without client state at all
- TanStack Query owns the cache for the handful of genuinely client-interactive views (applications inbox with live-ish polling, question builder with local drag-reorder state before save)
- Auth/session state lives in cookies, read via middleware and Server Components, not duplicated into a client store

**Local component state** (`useState`/`useReducer`) is sufficient for: job-creation wizard step state, question-builder drag ordering before commit, form state (owned by React Hook Form).

**Revalidation pattern:** mutations (create job, add question, upload storage config) call a Server Action or route handler, then `revalidateTag('jobs')` / `revalidateTag('applications')` so any Server Component reading that tag refetches — avoids manual cache-busting logic scattered through the app.

---

## 6. Key UI Flows in Detail

### 6.1 Job creation wizard (`/jobs/new`)

Multi-step, state held in the page's Client Component wrapper (not persisted to the backend until final submit, to avoid littering the DB with abandoned drafts — or optionally auto-saved as `status: draft` after step 1, tenant's choice, flag as open question):

1. **Details** — title, description (rich text via a minimal editor, e.g. Tiptap), location, employment type, department
2. **Questions** — the question builder (see 6.2), pre-populated with sensible defaults (name, email, resume) that can be edited/removed
3. **Storage target** — choose hosted / S3 / Google Drive / Telegram; if a target is already configured in `/settings/storage`, offer it as a one-click select rather than re-entering credentials per job
4. **Review** — renders a live preview of the exact JSON the public `GET /v1/public/jobs/{id}` endpoint will return, so the business can sanity-check the schema their developer will consume before publishing

### 6.2 Question builder

- Each question row: label, field key (auto-slugified from label, editable), type selector (text/textarea/select/multiselect/file/boolean/number/email/phone), required toggle, and — for select/multiselect — an options editor
- Drag-to-reorder (updates `sort_order`), using a lightweight library (`@dnd-kit/sortable`) rather than a heavier drag framework
- Field key uniqueness validated client-side against the current question set before allowing save, since `field_key` is what the applicant's POST payload keys off of

### 6.3 Applications inbox (`/applications`, `/jobs/[jobId]/applications`)

- Table view: applicant identifier, submitted date, status (received/forwarded/failed), quick-view drawer rather than full page nav for reading answers
- Status badges reflect `applications.status` from the backend (§4 of backend spec) — a `failed` forwarding status (e.g. webhook to the business's ATS failed) surfaces prominently with a retry action, not buried
- Resume link opens/downloads based on `storage_target` — hosted files proxy through a short-lived signed URL from the backend; S3/GDrive/Telegram-stored files link out to wherever the business's own storage puts them

### 6.4 Billing (`/billing`, `/billing/upgrade`)

- Current plan, usage-this-cycle (storage GB if on hosted tier, application volume) shown as simple progress bars, not charts, since usage vs. a flat/generous quota doesn't need a time series for v0.1
- `/billing/upgrade`: region-aware — if `tenants.region === 'BD'`, show UddoktaPay flow (redirect to UddoktaPay-hosted checkout, return to `/billing?status=success`); otherwise render Paddle's checkout overlay (`Paddle.Checkout.open()` via Paddle.js) inline, no full-page redirect needed for the global rail

---

## 7. Design Direction

The admin panel is a working tool used daily by a small team, not a marketing surface — the design brief here is "get out of the way," not "make a statement." That said, "get out of the way" is itself a choice worth making deliberately rather than defaulting to an unstyled shadcn/ui template:

- **Palette:** neutral slate/zinc base, single accent color reserved for primary actions and status (published/active states) — avoid the common AI-generated defaults (warm cream + terracotta, or stark black + acid accent) since neither fits a B2B ops tool used for hours at a stretch; a calmer, slightly cool neutral reduces eye strain over a workday
- **Density:** favor information density over generous whitespace in tables (applications inbox, job list) — this is a tool for people processing volume, not a landing page; but keep the job-creation wizard and question builder more spacious since those are lower-frequency, higher-focus tasks
- **Typography:** a single well-set system/Inter-class sans for UI chrome and data tables; no display serif needed anywhere in this surface — this isn't the marketing site
- **Motion:** minimal and functional only — drawer/dialog transitions, drag-reorder feedback, toast entrances. No ambient or decorative animation; this is a tool people will have open for hours, and decorative motion becomes noise fast at that exposure level
- **Empty/error states:** written in plain, direct language per the interface-writing conventions in the design skill — e.g., an empty applications inbox says what will happen when someone applies, not just "No data"

This section intentionally stays high-level — actual token values (exact hex, type scale) get finalized when the component library is scaffolded, not locked in the spec.

---

## 8. API Client Layer

- Backend OpenAPI schema (FastAPI auto-generates at `/openapi.json`) feeds `openapi-typescript` to generate a typed client (`lib/api/generated.ts`) — regenerated via a `pnpm gen:api` script whenever the backend schema changes, checked into the repo so the frontend build doesn't depend on a live backend at build time
- A thin wrapper (`lib/api/client.ts`) wraps the generated types with cookie-forwarding `fetch` calls, centralized error handling (401 → trigger refresh-or-redirect, 429 → surface rate-limit toast, 5xx → generic retry toast)
- Server Components import the server-side client (forwards `cookies()`); Client Components use a parallel client that relies on the browser sending cookies automatically (`credentials: 'include'`), used inside TanStack Query hooks

---

## 9. Docker

```dockerfile
# admin/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build   # next.config.js: output: 'standalone'

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Slots into the `admin` service already defined in `docker-compose.yml` in the backend spec — no changes needed there beyond ensuring `NEXT_PUBLIC_API_URL` (browser-facing) and `API_URL` (server-to-server, can stay on the internal Docker network name rather than a public URL) are both supplied via env.

---

## 10. Out of Scope for v0.1

- Dark mode (revisit post-launch based on actual usage patterns, not assumed as a default requirement)
- Real-time updates via WebSocket for the applications inbox (polling via TanStack Query's `refetchInterval` is sufficient at this scale; revisit if volume grows)
- i18n/localization of the admin panel UI itself (English-only for v0.1; the *public API* businesses build on top of is language-agnostic since Rolewire never renders applicant-facing copy)
- Mobile-optimized layouts beyond basic responsiveness — this is a desktop-first operational tool

---

## 11. Open Questions

1. Should the job-creation wizard auto-save as `draft` after step 1, or hold state client-side until final submit? Auto-save is friendlier for interrupted sessions but adds abandoned-draft cleanup considerations.
2. Rich text for job descriptions — confirm Tiptap (or similar) vs. plain markdown textarea; markdown is simpler to spec and matches the public API returning a `description` string cleanly, but a WYSIWYG is friendlier for non-technical HR users.
3. Applications inbox polling interval — needs to balance perceived real-time-ness against unnecessary API load at scale; start conservative (e.g. 30s) and revisit.
4. Whether `/settings/team` invite flow needs email-based invites (via SMTP) for v0.1 or can wait, given multi-seat RBAC is already flagged out-of-scope for v0.1 in the backend spec.