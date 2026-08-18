# Rolewire — Technical Specification

**Version:** 0.1 (Draft)
**Status:** Pre-build
**Owner:** InsanLab / Team Sabily

---

## 1. Overview

Rolewire is a headless job-posting and application-collection API. Businesses manage job postings and view applicants through an admin panel (no public-facing UI is provided by Rolewire). Two unauthenticated public endpoints let businesses embed job data and collect applications on their own custom-branded career pages:

- `GET /v1/public/jobs` — returns job posts as JSON, including custom fields/questions and question types
- `POST /v1/public/jobs/{job_id}/apply` — accepts a job application submission

Applications can be routed to Rolewire's hosted storage (pay-as-you-go), the business's own storage (S3, Google Drive, Telegram private channel — free), and optionally forwarded into a hosted OpenCATS instance or the business's own ATS via webhook.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| API | FastAPI (Python 3.12) | Async, OpenAPI docs auto-generated at `/docs` (disabled in prod, gated behind admin auth) |
| Admin Panel | Next.js 14+ (App Router) | Server components for dashboard, client components for forms |
| Primary DB | PostgreSQL 16 | Single instance, row-level tenant isolation (see §4) |
| Cache / Queue | Redis 7 | Rate limiting, background job queue (application webhook delivery, email sending) |
| Object Storage (hosted tier) | S3-compatible (DigitalOcean Spaces or AWS S3) | Only used when tenant opts into Rolewire-hosted storage |
| Background workers | Celery or FastAPI + `arq` (lighter-weight, Redis-native) | Webhook delivery, storage push, email dispatch, plan usage metering |
| Auth (admin panel) | JWT (HS256), issued by FastAPI auth module | Shorter-lived access token + refresh token pair; supports password login **and** OAuth (Google, Facebook, GitHub, LinkedIn) — see §5.3 |
| Auth (public API) | None — intentionally unauthenticated per job posting/application endpoints | Rate-limited by IP + job_id instead |
| Reverse proxy | Nginx or Caddy | TLS termination, routes `/v1/public/*` and `/v1/admin/*` to FastAPI, `/` to Next.js |
| Containerization | Docker, docker-compose | Single compose file for dev; split compose + profiles for prod |
| Payments | **Paddle** (Merchant of Record) for global card payments; **UddoktaPay** (bKash/Nagad) for Bangladesh | Region resolved by payment method availability, not IP/country dropdown — see §9 |
| Email | **Direct SMTP** (transactional: OTP, application-received receipts, plan notices) | Templates rendered locally (Jinja2) and sent over SMTP from the FastAPI worker; no third-party ESP |
| Monitoring | Uptime Kuma | Matches existing infra pattern |

---

## 3. Tenancy Model

**Model: Shared database, shared schema, tenant-scoped rows (pooled multi-tenancy).**

### Why not schema-per-tenant or database-per-tenant

At $9–14/mo price points, per-tenant infrastructure overhead (connection pool exhaustion, migration fan-out across hundreds of schemas, backup complexity) does not pay for itself. Pooled multi-tenancy with strict row-level isolation is the standard choice for this price tier and scales into the thousands of tenants on a single Postgres instance before resharding is worth considering.

### Isolation mechanism

Every tenant-owned table carries a `tenant_id UUID NOT NULL` column, and **Postgres Row-Level Security (RLS)** is enabled on all tenant tables:

```sql
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON jobs
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

The FastAPI request lifecycle sets `app.current_tenant_id` via `SET LOCAL` at the start of each transaction, derived from:
- Admin panel requests: the `tenant_id` claim in the verified JWT
- Public API requests: resolved from the `job_id` (public endpoints look up the owning tenant server-side; the caller never supplies a tenant identifier directly)

This means a bug in application-layer `WHERE` clauses cannot leak cross-tenant data — RLS is the last line of defense, not the only one.

### Tenant resolution for public endpoints

Public endpoints do not take a tenant ID or API key. Instead:
- `GET /v1/public/jobs?job_id={id}` or `GET /v1/public/jobs/{job_id}` — job_id is a non-guessable UUID/ULID; tenant is looked up server-side from the job record
- Optionally, a `GET /v1/public/jobs?slug={company-slug}` variant for businesses that want a stable, human-readable listing endpoint — resolves `slug → tenant_id` via a unique indexed lookup

### Plan/quota enforcement

Each tenant row carries `plan_id`, `billing_cycle`, `status` (active/past_due/suspended). Redis holds a rolling counter per tenant for metered usage (storage MB, application volume beyond free tier) to avoid hitting Postgres on every hot-path request; counters flush to Postgres hourly for billing reconciliation.

---

## 4. Core Database Schema (simplified)

```sql
-- Tenants (businesses)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan_id UUID REFERENCES plans(id),
    billing_cycle TEXT CHECK (billing_cycle IN ('monthly','yearly')),
    status TEXT DEFAULT 'active',
    region TEXT,                     -- resolved payment region, e.g. 'BD', 'GLOBAL'
    payment_provider TEXT,           -- 'uddoktapay' | 'paddle' | etc.
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Admin panel users (business staff)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email TEXT UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    password_hash TEXT,              -- nullable: OAuth-only users have no password
    avatar_url TEXT,                 -- populated from OAuth provider profile, if available
    role TEXT DEFAULT 'admin',       -- admin | member (future: RBAC expansion)
    created_at TIMESTAMPTZ DEFAULT now()
);
-- Note: "must have password OR at least one linked oauth_account" is enforced at the
-- application layer (service function that creates users), not as a DB CHECK constraint —
-- Postgres CHECK constraints cannot reference other tables.

-- Linked OAuth identities (one user can link multiple providers)
CREATE TABLE oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,          -- google | facebook | github | linkedin
    provider_user_id TEXT NOT NULL,  -- stable ID from the provider (sub / id)
    provider_email TEXT,             -- email as returned by provider, may differ from users.email
    access_token_encrypted BYTEA,    -- envelope-encrypted; only retained if needed for provider API calls post-login
    refresh_token_encrypted BYTEA,
    token_expires_at TIMESTAMPTZ,
    raw_profile JSONB,               -- provider profile payload snapshot at link time (debugging/support)
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (provider, provider_user_id)
);

-- Job postings
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    employment_type TEXT,
    department TEXT,
    status TEXT DEFAULT 'draft',     -- draft | published | closed
    storage_target TEXT DEFAULT 'hosted', -- hosted | s3 | gdrive | telegram
    storage_config_id UUID REFERENCES storage_configs(id),
    ats_webhook_url TEXT,            -- optional: forward applications to business's own ATS
    opencats_sync BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Custom application questions per job
CREATE TABLE job_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    label TEXT NOT NULL,
    field_key TEXT NOT NULL,          -- machine-readable key used in POST payload
    question_type TEXT NOT NULL,      -- text | textarea | select | multiselect | file | boolean | number | email | phone
    options JSONB,                    -- for select/multiselect
    required BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0
);

-- Applications received
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    answers JSONB NOT NULL,           -- { field_key: value, ... }
    resume_ref TEXT,                  -- pointer/URL into storage_target (not the file itself, unless hosted)
    applicant_email TEXT,
    status TEXT DEFAULT 'received',   -- received | forwarded | failed
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Storage destination configs (business's own storage credentials, encrypted at rest)
CREATE TABLE storage_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    type TEXT NOT NULL,               -- s3 | gdrive | telegram
    encrypted_credentials BYTEA NOT NULL, -- envelope-encrypted via 1Password/KMS-managed key
    config JSONB,                     -- bucket name, folder ID, channel ID, etc.
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Plans (pricing tiers)
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,               -- basic | pro | ...
    monthly_price_usd NUMERIC,
    yearly_price_usd NUMERIC,
    features JSONB                    -- { email_sending: bool, opencats_included: bool, ... }
);

-- Usage metering (storage, hosted ATS, etc.)
CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    event_type TEXT NOT NULL,         -- storage_mb | opencats_active | application_received
    quantity NUMERIC NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT now()
);
```

All tenant-scoped tables (`jobs`, `job_questions`, `applications`, `storage_configs`, `usage_events`, `users`) get RLS policies as shown in §3.

---

## 5. API Design

### 5.1 Public API (unauthenticated, rate-limited)

```
GET  /v1/public/jobs                     # list published jobs (optionally filtered by ?slug=)
GET  /v1/public/jobs/{job_id}             # single job post: fields, questions, question types
POST /v1/public/jobs/{job_id}/apply       # submit an application
```

**Example response — `GET /v1/public/jobs/{job_id}`:**

```json
{
  "id": "job_01hz...",
  "title": "Backend Engineer",
  "description": "...",
  "location": "Remote",
  "employment_type": "full_time",
  "questions": [
    {
      "field_key": "full_name",
      "label": "Full Name",
      "type": "text",
      "required": true
    },
    {
      "field_key": "resume",
      "label": "Resume/CV",
      "type": "file",
      "required": true
    },
    {
      "field_key": "years_experience",
      "label": "Years of Experience",
      "type": "number",
      "required": true
    },
    {
      "field_key": "notice_period",
      "label": "Notice Period",
      "type": "select",
      "options": ["Immediate", "2 weeks", "1 month", "2+ months"],
      "required": true
    }
  ]
}
```

**Example request — `POST /v1/public/jobs/{job_id}/apply`:**

```json
{
  "answers": {
    "full_name": "Jane Doe",
    "years_experience": 4,
    "notice_period": "1 month"
  },
  "files": {
    "resume": "<multipart file part or pre-signed upload token>"
  },
  "applicant_email": "jane@example.com"
}
```

File handling: large uploads (resumes) go through a **two-step flow** — client requests a pre-signed upload URL scoped to the tenant's `storage_target`, uploads directly to storage, then submits the application referencing the resulting `resume_ref`. This keeps FastAPI off the file-proxying hot path entirely for hosted S3/GDrive targets. Telegram, lacking pre-signed URLs, is handled server-side via bot API relay (small file size limits apply — document this constraint to tenants up front).

**Rate limiting:** Redis-backed, keyed by `(job_id, ip_hash)` — e.g. 1 application per IP per job per 10 minutes, tunable per plan. GET endpoints rate-limited more loosely by IP alone to prevent scraping abuse.

### 5.2 Admin API (JWT-authenticated)

```
POST   /v1/admin/auth/login
POST   /v1/admin/auth/refresh
GET    /v1/admin/auth/oauth/{provider}/start
GET    /v1/admin/auth/oauth/{provider}/callback
POST   /v1/admin/auth/oauth/{provider}/link
DELETE /v1/admin/auth/oauth/{provider}

GET    /v1/admin/jobs
POST   /v1/admin/jobs
PATCH  /v1/admin/jobs/{id}
DELETE /v1/admin/jobs/{id}
POST   /v1/admin/jobs/{id}/questions

GET    /v1/admin/applications?job_id=
GET    /v1/admin/applications/{id}

POST   /v1/admin/storage-configs         # connect S3/GDrive/Telegram
GET    /v1/admin/storage-configs

GET    /v1/admin/billing
POST   /v1/admin/billing/upgrade

# Payment provider webhooks (signature-verified, not JWT-protected — see §12)
POST   /v1/webhooks/paddle
POST   /v1/webhooks/uddoktapay
```

All admin routes require a valid JWT; middleware extracts `tenant_id` from the token and sets the Postgres session variable for RLS before any query executes.

### 5.3 Social Login (Google, Facebook, GitHub, LinkedIn)

**Library:** `authlib` (FastAPI-native OAuth2/OIDC client) rather than hand-rolling each provider's flow — all four providers below speak OAuth2 + OIDC-compatible profile endpoints, so one generic handler covers all of them with per-provider config.

**Flow (Authorization Code + PKCE):**

```
GET  /v1/admin/auth/oauth/{provider}/start        # redirects to provider's consent screen
GET  /v1/admin/auth/oauth/{provider}/callback      # provider redirects back here with ?code=
POST /v1/admin/auth/oauth/{provider}/link          # link a provider to an already-logged-in user
DELETE /v1/admin/auth/oauth/{provider}              # unlink a provider (blocked if it's the user's only login method)
```

1. `/start` generates a PKCE `code_verifier`/`code_challenge` pair and a signed `state` param (CSRF protection), stores the verifier server-side keyed by `state` (Redis, 5 min TTL), redirects to the provider.
2. Provider redirects to `/callback?code=...&state=...`. Backend validates `state`, exchanges `code` for tokens, fetches the provider's profile/userinfo endpoint.
3. **Account resolution logic:**
   - If `oauth_accounts` already has a row for `(provider, provider_user_id)` → log in as that user.
   - Else if `provider_email` matches an existing `users.email` → **link** the OAuth identity to that existing account (do not silently auto-merge without the email being verified by the provider — Google/GitHub/LinkedIn verify email ownership; Facebook does not always, so treat Facebook email matches as "requires confirmation" rather than auto-link).
   - Else → create a new `tenants` + `users` row (first-time signup via social login) or prompt to join an existing tenant if invited.
4. Issue Rolewire's own JWT pair (access + refresh) — the provider's tokens are not used for ongoing session auth, only for the initial identity handshake. Provider tokens are only persisted in `oauth_accounts` if a feature later needs to call back to the provider's API (e.g., importing a GitHub org for team invites); otherwise discard after profile fetch.

**Per-provider notes:**

| Provider | Auth type | Notes |
|---|---|---|
| Google | OAuth2 + OIDC | Standard `openid email profile` scopes; email always verified |
| GitHub | OAuth2 (not full OIDC) | No `id_token`; fetch `/user` and `/user/emails` separately since primary email may be private |
| Facebook | OAuth2 (Graph API) | Email scope can be denied by user even after granting login — handle "no email returned" case explicitly, fall back to prompting for email |
| LinkedIn | OAuth2 + OIDC (`Sign In with LinkedIn using OpenID Connect`) | Use the OIDC-flavored product, not the older legacy LinkedIn login API which Microsoft has been deprecating piecemeal — confirm current endpoint at build time |

**Security:**
- `state` and PKCE `code_verifier` are mandatory for all four providers, not optional
- Redirect URIs are allow-listed per provider app registration, never dynamically constructed from request input
- Access/refresh tokens in `oauth_accounts`, if retained, are envelope-encrypted the same way as `storage_configs` credentials

> **Flag for you:** this introduces exactly the "Google/big-tech OAuth dependency" that GuptoAI's stated principles explicitly avoid. That's a reasonable trade-off for Rolewire specifically — social login is a genuine conversion-rate lever for a B2B SaaS signup flow, and this isn't a consumer product doing content moderation via Google's infra — but worth being a deliberate exception, not a default carried over unconsciously from the GuptoAI mission statement.

---

## 6. Storage Integration Modes

| Mode | Who holds the file | Rolewire liability | Pricing |
|---|---|---|---|
| `hosted` | Rolewire's S3-compatible bucket | Rolewire is a data processor for applicant PII | Pay-as-you-go (per GB, corrected from earlier per-MB draft) |
| `s3` | Business's own bucket, Rolewire holds pre-signed write credentials only | Business is the data controller | Free |
| `gdrive` | Business's own Google Drive folder | Business is the data controller | Free |
| `telegram` | Business's own private Telegram channel | Business is the data controller | Free |

`hosted` mode is the only one requiring Rolewire to store applicant PII at rest — this has direct implications for the PDPA 2026 Privacy Policy sub-processor section and should be flagged to legal review alongside the GuptoAI documents already in progress.

---

## 7. Optional Hosted OpenCATS Integration

- Tenants on a compatible plan get a **provisioned OpenCATS instance** (containerized, one per tenant or namespaced within a shared instance — TBD pending OpenCATS multi-tenancy R&D)
- Applications matching `opencats_sync = true` on a job are pushed via OpenCATS's REST/SOAP API (needs R&D spike — OpenCATS's native API surface is not as modern as Greenhouse/Ashby's; a translation layer may be required)
- Alternative path: `ats_webhook_url` lets a business forward applications to *any* ATS (their own OpenCATS, or Greenhouse/Ashby/etc.) without Rolewire hosting anything — this is the lower-effort, ship-first option and should probably land before the hosted-OpenCATS R&D completes

---

## 8. Docker Compose Layout

```yaml
version: "3.9"

services:
  api:
    build: ./api
    env_file: .env
    depends_on:
      - postgres
      - redis
    ports:
      - "8000:8000"

  worker:
    build: ./api
    command: arq worker.WorkerSettings
    env_file: .env
    depends_on:
      - postgres
      - redis

  admin:
    build: ./admin
    env_file: .env
    depends_on:
      - api
    ports:
      - "3000:3000"

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: rolewire
      POSTGRES_USER: rolewire
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
      - admin
    ports:
      - "80:80"
      - "443:443"

volumes:
  pgdata:
  redisdata:
```

**Secrets:** follow the existing GuptoAI pattern — `1Password CLI (op run)` injects env vars at container start rather than committing `.env` to the repo. Sourced this way: `POSTGRES_PASSWORD`, JWT signing secret, storage-encryption key, OAuth client ID/secret pairs (Google, Facebook, GitHub, LinkedIn), Paddle API key + webhook secret, UddoktaPay API key + webhook secret, and SMTP credentials.

**Prod split:** in production, `postgres` and `redis` likely move to managed/dedicated services (or stay on `zaka-lab`-style droplet per existing infra conventions), and this compose file splits into `docker-compose.yml` (app services) + `docker-compose.override.prod.yml`.

---

## 9. Payments: Paddle (Global) + UddoktaPay (Bangladesh)

### 9.1 Region resolution

`tenants.region` and `tenants.payment_provider` are set based on **which checkout flow the business enters**, not a self-reported country field:

- `/pricing` (global) → Paddle Checkout (hosted or overlay) → card/PayPal/etc., Paddle handles VAT/GST/sales tax as Merchant of Record
- `/pricing/bd` (or auto-suggested via Accept-Language / a soft geo hint, but user-confirmed, not auto-redirected silently) → UddoktaPay → bKash/Nagad, BDT-denominated

This keeps the two rails structurally separate rather than trying to run one unified "smart pricing" table — avoids the arbitrage/spoofing problem discussed earlier, since bKash/Nagad simply don't work for a payer outside Bangladesh's banking rails.

### 9.2 Schema additions

```sql
-- Subscriptions (one active row per tenant; history kept via status transitions, not deletion)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    plan_id UUID NOT NULL REFERENCES plans(id),
    provider TEXT NOT NULL,             -- 'paddle' | 'uddoktapay'
    provider_subscription_id TEXT,      -- Paddle subscription ID (null for UddoktaPay, see 9.4)
    billing_cycle TEXT CHECK (billing_cycle IN ('monthly','yearly')),
    status TEXT DEFAULT 'active',       -- active | past_due | canceled | paused
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Raw payment/invoice records (both providers write here for a unified billing history view)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    subscription_id UUID REFERENCES subscriptions(id),
    provider TEXT NOT NULL,
    provider_invoice_id TEXT,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL,             -- 'USD' | 'BDT'
    status TEXT NOT NULL,               -- paid | failed | refunded
    raw_payload JSONB,                  -- full webhook payload, for reconciliation/support
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 9.3 Paddle integration

- **Paddle Billing** (not the older "Paddle Classic") for subscription checkout — hosted checkout or Paddle.js overlay embedded in the Next.js admin panel's billing/upgrade page
- Webhook endpoint: `POST /v1/webhooks/paddle` — verifies Paddle's webhook signature, handles `subscription.created`, `subscription.updated`, `subscription.canceled`, `transaction.completed`, `transaction.payment_failed`
- Paddle is the Merchant of Record: it calculates and remits VAT/GST per buyer jurisdiction, so Rolewire never touches EU VAT/US sales-tax registration directly for this rail
- Plan upgrades/downgrades and proration are delegated to Paddle's subscription-update API rather than reimplemented — `subscriptions.plan_id` is updated locally on receipt of the `subscription.updated` webhook, treating Paddle as the source of truth

### 9.4 UddoktaPay integration

- UddoktaPay is a checkout aggregator, not a subscription-billing platform — it processes one-time charges. **Recurring billing is emulated**: on successful payment, `subscriptions.current_period_end` is set to `now() + 1 month` (or `+1 year`), and a scheduled worker job checks daily for subscriptions nearing expiry to trigger a renewal payment link sent via SMTP email + optionally a reminder pushed to the tenant's connected Telegram, if applicable
- Webhook endpoint: `POST /v1/webhooks/uddoktapay` — verifies UddoktaPay's callback signature, marks the invoice `paid`, extends `current_period_end`
- No `provider_subscription_id` exists on this rail (UddoktaPay has no subscription object) — `subscriptions.provider_subscription_id` stays null for `provider = 'uddoktapay'` rows; renewal state lives entirely in Rolewire's own `subscriptions`/`invoices` tables
- Grace period: on missed renewal, `subscriptions.status` moves to `past_due` for a configurable window (e.g. 5 days) before `tenants.status` flips to `suspended` and public API responses for that tenant's jobs start returning `410 Gone` with a message pointing to the renewal link

### 9.5 Plan/price sync

`plans` table stays the source of truth for feature flags (`opencats_included`, `email_sending`, etc.); `monthly_price_usd`/`yearly_price_usd` on that table mirror what's configured in Paddle's product catalog — Paddle product/price IDs are stored in `plans.features` (or a dedicated `paddle_price_id` column) so the webhook handler can map an incoming `price_id` back to a local `plan_id`. UddoktaPay pricing (BDT) is configured independently per plan since it's a separate, non-Paddle-managed rail.

---

## 10. Repository Structure (proposed)

```
rolewire/
├── api/                      # FastAPI service
│   ├── app/
│   │   ├── main.py
│   │   ├── core/             # config, security, db session, RLS context middleware
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── routers/
│   │   │   ├── public.py     # unauthenticated endpoints
│   │   │   └── admin.py      # JWT-protected endpoints
│   │   ├── services/         # storage adapters (s3, gdrive, telegram), webhook dispatch
│   │   └── worker.py         # arq/Celery task definitions
│   ├── alembic/               # migrations
│   ├── Dockerfile
│   └── requirements.txt
├── admin/                    # Next.js admin panel
│   ├── app/
│   ├── components/
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── .env.example
└── spec.md
```

---

## 11. Email (direct SMTP)

- All outbound transactional email (OTP/magic-link if added later, welcome email, application-received receipt to applicant, renewal reminders, payment-failed notices, plan-upgrade confirmations) is sent **directly over SMTP** (`aiosmtplib`) from the FastAPI worker — no third-party ESP
- Templates are Jinja2 files in the repo (`app/templates/email/`, HTML + plaintext per key), referenced by template key from `services/email.py`; copy changes ship through a normal deploy
- No delivery-event webhook: plain SMTP has no bounce/complaint push notification (that would need a bounce mailbox + DSN parsing), so Rolewire does not track per-address deliverability — a send either succeeds at SMTP-accept time or raises
- Pro-tier "email sending to applicants" feature (from the pricing tiers discussed earlier), if built, would need a **dedicated sending domain/relay** separate from Rolewire's own transactional SMTP account, so a tenant's bulk applicant-communication volume/reputation never affects Rolewire's own OTP/billing email deliverability

---

## 12. Security Notes

- All tenant-scoped queries pass through RLS as a defense-in-depth layer, never relied on alone — application-layer `tenant_id` filters remain in place too
- Storage credentials (`storage_configs.encrypted_credentials`) are envelope-encrypted; the encryption key itself lives in 1Password/KMS, never in the database or repo
- OAuth access/refresh tokens in `oauth_accounts`, where retained, use the same envelope-encryption pattern
- Public endpoints get aggressive rate limiting and payload size caps (file uploads capped per plan) to prevent abuse of the intentionally-unauthenticated surface
- IPs are never persisted; `ip_hash` is derived transiently and only lives in the Redis rate-limit key (TTL'd)
- CORS on public endpoints is intentionally permissive (`*`) since businesses embed these on arbitrary custom domains — admin endpoints are strictly locked to the admin panel's own origin
- Payment webhook endpoints (`/v1/webhooks/paddle`, `/v1/webhooks/uddoktapay`) verify provider signatures before processing and are excluded from the general admin JWT requirement — signature verification is the auth for these routes

---

## 13. Out of Scope for v0.1

- Resume parsing / AI screening (future add-on, not core spec)
- Multi-seat RBAC beyond `admin`/`member` (flat roles for v0.1)
- Native LinkedIn/Indeed job board syndication
- Hosted OpenCATS multi-tenancy (ship webhook-forwarding first, OpenCATS hosting is a fast-follow pending R&D)
- SSO/SAML for enterprise tenants (social login only for v0.1; SAML would be a higher-tier add-on later)

---

## 14. Open Questions

1. OpenCATS multi-tenant hosting model — one container per tenant vs. shared instance with app-level tenant separation (OpenCATS itself has no native multi-tenancy)
2. Final per-GB hosted storage price (confirm $0.50/**GB**, not /MB, before publishing pricing page)
3. Telegram file-size ceiling and how it's communicated to tenants choosing that storage mode
4. Whether `job_questions.options` needs conditional logic (show question B only if question A = X) for v0.1, or is a v2 feature
5. LinkedIn's OIDC-based "Sign In with LinkedIn" product surface has shifted before — confirm exact current scopes/endpoints at implementation time rather than trusting this spec's provider table verbatim
6. Whether UddoktaPay's emulated-subscription renewal flow needs a manual "pay now" fallback UI for tenants whose auto-renewal payment link goes unopened (BD market may skew toward manual bKash confirmation over saved-card auto-charge)