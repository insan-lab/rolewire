# Rolewire

Headless job-posting and application-collection API. Businesses manage postings through an admin
panel; two unauthenticated public endpoints let them embed job data and collect applications on
their own custom-branded career pages.

Full design: [`docs/spec.md`](docs/spec.md). This README covers what is built and how to run it.

## Status

| Component | State |
|---|---|
| FastAPI service (`api/`) — public API, admin API, webhooks, worker | implemented |
| Postgres schema + RLS migration (`api/alembic/`) | implemented |
| Storage adapters: hosted S3, tenant S3, Google Drive, Telegram | implemented |
| Payments: Paddle + UddoktaPay (checkout, webhooks, renewal emulation) | implemented |
| Brevo transactional email + delivery webhook | implemented |
| Docker Compose, Nginx, least-privilege Postgres role | implemented |
| Next.js admin panel (`admin/`), containerized | implemented |
| Hosted OpenCATS provisioning | out of scope for v0.1 (§13); `ats_webhook_url` forwarding ships instead |

## Quick start

```bash
uv pip install -e ".[dev]"     # or: make install
cp .env.example .env           # fill JWT_SECRET, ENCRYPTION_KEY, IP_HASH_SALT
make test                      # 95 tests, no external services needed
```

Generate the two cryptographic values:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"                    # JWT_SECRET, IP_HASH_SALT
cd api && python -m app.cli generate-encryption-key                             # ENCRYPTION_KEY
```

Run the stack:

```bash
docker compose up --build -d   # api + worker + postgres + redis + nginx
make migrate                   # or let the api container's entrypoint do it
make seed                      # default basic/pro plans
```

Local development without Docker:

```bash
make run       # uvicorn with autoreload on :8000, docs at /docs
make worker    # arq worker (webhook delivery, receipts, usage flush, renewal sweep)
```

## Endpoints

Public (unauthenticated, rate-limited, CORS `*`):

```
GET  /v1/public/jobs[?slug=&limit=&offset=]     list published jobs
GET  /v1/public/jobs/{job_id}                    job post + questions with types
POST /v1/public/jobs/{job_id}/upload-ticket      direct-to-storage upload ticket
POST /v1/public/jobs/{job_id}/uploads            server relay (Telegram targets only)
POST /v1/public/jobs/{job_id}/apply              submit an application
```

Admin (JWT, CORS locked to the panel origin):

```
POST   /v1/admin/auth/signup | /login | /refresh
GET    /v1/admin/auth/me
GET    /v1/admin/auth/oauth/{provider}/start
GET    /v1/admin/auth/oauth/{provider}/callback
POST   /v1/admin/auth/oauth/{provider}/link
DELETE /v1/admin/auth/oauth/{provider}
GET    /v1/admin/jobs | POST /v1/admin/jobs
GET    /v1/admin/jobs/{id} | PATCH | DELETE
POST   /v1/admin/jobs/{id}/questions             replace the question set
GET    /v1/admin/applications[?job_id=]
GET    /v1/admin/applications/{id}
GET    /v1/admin/storage-configs | POST | DELETE /{id}
GET    /v1/admin/billing | /billing/plans | POST /billing/upgrade
```

Webhooks (signature-authenticated, no JWT): `POST /v1/webhooks/{paddle,uddoktapay,brevo}`.

Ops: `GET /health`, `GET /health/ready`.

## Tenant isolation

Pooled multi-tenancy with Postgres RLS as the last line of defense (§3). Three session flags,
all set with `SET LOCAL` semantics so they cannot leak across pooled connections:

| Flag | Set by | Grants |
|---|---|---|
| `app.current_tenant_id` | admin auth dependency; public endpoints after resolving the job | full read/write on that tenant's rows |
| `app.public_context` | public endpoints, before the job is known | SELECT on published jobs and their questions |
| `app.auth_context` | login and OAuth callback | SELECT on `users`/`oauth_accounts` for identity lookup |

Application-layer `tenant_id` filters stay in place regardless — RLS is defense in depth, not the
only mechanism. The API connects as `rolewire_app`, a non-owner role without `BYPASSRLS`
(`postgres/init/01-app-role.sh`), and every tenant table is `FORCE ROW LEVEL SECURITY`.

Public endpoints never accept a tenant identifier: tenancy is resolved server-side from the
non-guessable `job_id`, or from a company `slug` for stable listing URLs.

## Testing

The suite runs on SQLite so it needs no Postgres or Redis: RLS statements are no-ops off Postgres,
and the rate limiter/usage counters use their in-process fallbacks (`REDIS_ENABLED=false`).

The RLS policies themselves are meaningless to test on SQLite, so they have a dedicated Postgres
suite that skips by default:

```bash
ROLEWIRE_TEST_PG_URL=postgresql+asyncpg://user:pass@localhost:5432/rolewire_test \
  .venv/bin/python -m pytest api/tests/test_rls_postgres.py
```

It asserts up front that the connecting role does not bypass RLS, so it cannot pass for the wrong
reason. Point it at a throwaway database — it runs `alembic downgrade base` first.

## Security notes

- Applicant IPs are never persisted. A salted HMAC of the IP is used transiently as a Redis
  rate-limit key (TTL'd, never written to the database).
- Storage credentials and retained OAuth tokens are Fernet-encrypted; the key comes from the
  environment (1Password/KMS) and never touches the database or repo. Credentials are never echoed
  back by the API.
- Public endpoints are rate-limited per `(job_id, ip_hash)` for applications and per IP for reads,
  with payload and upload size caps.
- Webhook routes verify provider signatures (Paddle HMAC with timestamp tolerance, UddoktaPay API
  key, Brevo shared secret/HMAC) and fail closed when the secret is unset.
- OAuth uses Authorization Code + PKCE with a mandatory server-side `state`; redirect URIs are
  built from configuration, never from request input. Facebook email matches never auto-link to an
  existing account because Facebook does not verify email ownership.
- `ENVIRONMENT=prod` refuses to boot with a short/default JWT secret, a missing encryption key, a
  default IP salt, or `REDIS_ENABLED=false`.
- Uploads bypass the API for every target that supports presigned URLs, so resume bytes are not
  proxied through FastAPI except on the Telegram relay path.

## Decisions worth knowing

- **File uploads are two-step.** Clients request an upload ticket, upload directly to the
  destination, then submit the application with the returned `resume_ref`. Telegram has no
  presigned concept, so it relays through `POST /v1/public/jobs/{id}/uploads` (Bot API caps
  documents at 50MB — open question §14.3).
- **SigV4 presigning is implemented directly** (`api/app/services/sigv4.py`) rather than adding
  boto3, since presigned PUT/GET is all that is needed.
- **UddoktaPay renewals are emulated**: a successful charge sets `current_period_end = now + cycle`;
  a daily worker sweep sends renewal reminders, moves lapsed subscriptions to `past_due`, and after
  `GRACE_PERIOD_DAYS` suspends the tenant, at which point public job endpoints return `410 Gone`.
- **Paddle is the source of truth** on the global rail: `/billing/upgrade` returns the price id for
  Paddle.js and local state is mirrored from webhooks.
- **`POST /v1/admin/jobs/{id}/questions` replaces the whole set** rather than appending, which keeps
  question ordering and `field_key` uniqueness trivially consistent.
- **Jobs with applications cannot be deleted** (409) — close them instead, so applicant records are
  never silently destroyed.
- **The initial migration creates tables from the SQLAlchemy metadata** and then applies the RLS
  policies as explicit DDL, since policies cannot be expressed in metadata. Later migrations use
  normal autogenerate.
- **`plans.paddle_*_price_id` are real columns** rather than keys inside `features`, so the webhook
  handler can map an incoming `price_id` back to a plan with an index-friendly query.

## Layout

```
api/
  app/
    core/       config, db + RLS context, security, crypto, rate limiting, redis
    models/     SQLAlchemy models (§4, §9.2)
    schemas/    Pydantic request/response models
    routers/    public, admin_auth, admin_oauth, admin_jobs, admin_storage, admin_billing, webhooks
    services/   accounts, answers, storage, sigv4, billing, email, dispatch, signatures, oauth, usage, queue
    worker.py   arq tasks + cron
    cli.py      seed-plans, list-plans, generate-encryption-key
  alembic/      migrations (0001 = schema + RLS)
  tests/        95 tests + 6 Postgres RLS tests that skip unless ROLEWIRE_TEST_PG_URL is set
nginx/          reverse proxy config
postgres/init/  least-privilege app role bootstrap
```
