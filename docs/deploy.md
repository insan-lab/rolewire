# Rolewire — Deploy Guide

**Companion to:** [`spec.md`](spec.md), [`frontend_spec.md`](frontend_spec.md)
**Scope:** getting the stack in `docker-compose.yml` running on a single host behind one public
domain. This is the "one droplet" deploy the project is sized for at launch — not a Kubernetes
guide.

---

## 0. What you're deploying

One Docker host runs six containers, all on Compose's default bridge network:

```
                 ┌──────────────────────────────────────────┐
 :443 (TLS edge) │                                          │
   ───────────►  │  nginx :80  ──┬─► admin (Next.js) :3000  │
  (see §3)       │               └──► api (FastAPI) :8000   │
                 │                        │                 │
                 │                        ▼                 │
                 │  worker (arq)  ──►  postgres :5432       │
                 │        │       ──►  redis :6379          │
                 │        ▼                                 │
                 │  (webhook delivery, receipt email,       │
                 │   usage flush, renewal sweep — cron)     │
                 └──────────────────────────────────────────┘
```

Everything — marketing pages, login, dashboard, and the `/v1/*` API — is served from **one public
domain**. `nginx.conf` path-routes by prefix: `/v1/public/*`, `/v1/admin/*`, `/v1/webhooks/*` go to
`api`; everything else goes to `admin`. One exception, and it matters: the OAuth callback path
`/v1/admin/auth/oauth/{provider}/callback` is claimed by the **admin app**, not the API — the
Next.js route handler at that exact path exchanges the code for tokens server-to-server and sets
session cookies on the browser's origin, which only works if the browser is actually talking to
the admin app there. `nginx.conf` has a regex location ahead of the general `/v1/admin/` rule to
send that one path to `admin` instead of `api`. If you ever re-order or rewrite the `server` block,
keep that location above the plain-prefix one — nginx's regex locations only win if you don't
accidentally introduce a `location =` exact match that beats them.

Because it's one domain, `postgres` and `redis` are not exposed publicly (bind to `127.0.0.1` in
`docker-compose.yml` already), and there is no cross-origin admin API — `ADMIN_ALLOWED_ORIGINS`
just needs your one domain.

---

## 1. Prerequisites

- A host with Docker Engine 24+ and the Compose plugin (`docker compose version` should print v2).
  A 2 vCPU / 4GB droplet is comfortable for launch scale — this mirrors the `zaka-lab`-style droplet
  convention the rest of the infra uses.
- A domain (or subdomain) with an A record you can point at the host, e.g. `app.rolewire.com`.
- Accounts/keys for whichever of these you're turning on at launch — everything is optional except
  Postgres/Redis, and the app degrades gracefully (features just return "not configured" errors)
  for anything left blank:
  - Paddle (global payments) — API key, webhook secret, and at least one product/price created in
    the Paddle dashboard
  - UddoktaPay (Bangladesh payments) — API key, webhook secret, base URL
  - SMTP account (transactional email) — host, port, username/password, from address
  - OAuth apps for whichever of Google/GitHub/Facebook/LinkedIn you want as login options
  - S3-compatible bucket if you're offering Rolewire-hosted storage (DigitalOcean Spaces, AWS S3)
- `git`, and somewhere to keep secrets out of the repo — the project's convention is 1Password
  (`op run --env-file=.env.op -- docker compose up`) rather than a committed `.env`. Plain `.env`
  works too; just don't commit it (`.gitignore` already excludes `.env*.local` — a plain `.env` at
  the repo root is *not* excluded by default, so double-check before your first `git add`).

---

## 2. Get the code

```bash
git clone https://github.com/insan-lab/rolewire.git
cd rolewire
```

---

## 3. TLS

`nginx.conf` only listens on port 80 — it's the *internal* reverse proxy that routes between `api`
and `admin`, not a TLS terminator. The simplest way to get HTTPS without hand-rolling certbot
volumes is to put a second, minimal proxy in front of it that only does TLS and forwards everything
else to `nginx:80`. [Caddy](https://caddyserver.com) does this in about four lines and renews certs
itself:

```caddyfile
# /etc/caddy/Caddyfile on the host, or a `caddy` service added to docker-compose.yml
app.rolewire.com {
    reverse_proxy nginx:80
}
```

If you'd rather terminate TLS in `nginx.conf` directly (one fewer moving part, more manual cert
handling), run certbot in webroot mode against the existing `:80` server block, then add a `:443`
server block that mounts the resulting certs and proxies the same locations — the location rules
in §0 don't change, only the `listen` directive and cert paths do.

Either way: **the public domain is one thing** — use the same value everywhere `*_BASE_URL` /
`*_URL` shows up in the next section.

---

## 4. Configure secrets

```bash
cp .env.example .env
```

Generate the two values the app refuses to boot without in prod (`api/app/core/config.py` enforces
this — a short/default `JWT_SECRET`, missing `ENCRYPTION_KEY`, default `IP_HASH_SALT`, or
`REDIS_ENABLED=false` all fail startup under `ENVIRONMENT=prod`):

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"   # JWT_SECRET
python -c "import secrets; print(secrets.token_urlsafe(48))"   # IP_HASH_SALT
cd api && python -m app.cli generate-encryption-key && cd ..   # ENCRYPTION_KEY
openssl rand -base64 24                                        # POSTGRES_PASSWORD
openssl rand -base64 24                                        # POSTGRES_APP_PASSWORD
```

Fill in `.env`, using your real domain in place of `app.rolewire.com`:

```ini
ENVIRONMENT=prod
LOG_LEVEL=INFO
EXPOSE_DOCS=false          # /docs is force-disabled in prod regardless of this flag — leave off

POSTGRES_PASSWORD=<generated>
POSTGRES_APP_PASSWORD=<generated>
DATABASE_URL=postgresql+asyncpg://rolewire_app:<POSTGRES_APP_PASSWORD>@postgres:5432/rolewire
REDIS_URL=redis://redis:6379/0
REDIS_ENABLED=true

JWT_SECRET=<generated>
ENCRYPTION_KEY=<generated>
IP_HASH_SALT=<generated>

APP_BASE_URL=https://app.rolewire.com
OAUTH_REDIRECT_BASE_URL=https://app.rolewire.com   # the admin app's origin, not the API's — see §0
ADMIN_ALLOWED_ORIGINS=https://app.rolewire.com

NEXT_PUBLIC_API_URL=https://app.rolewire.com
NEXT_PUBLIC_APP_URL=https://app.rolewire.com

# ...then Paddle/UddoktaPay/SMTP/OAuth/hosted-S3 keys from §5, whichever you're enabling
```

`DATABASE_URL` here is the app's own connection string (`rolewire_app`, the RLS-constrained role);
`POSTGRES_PASSWORD` is the *owner* role's password, used only by the `postgres` container itself
and the init script that creates `rolewire_app` (`postgres/init/01-app-role.sh`). Both are required
even though only one appears in `DATABASE_URL`.

---

## 5. Provider setup (do this before first boot where you can)

- **OAuth apps** (Google/GitHub/Facebook/LinkedIn, whichever you enable): register the app in each
  provider's console and set the authorized redirect URI to
  `https://app.rolewire.com/v1/admin/auth/oauth/{provider}/callback` — exactly the path from §0,
  on your admin domain. Put the client id/secret pairs in `.env`
  (`OAUTH_GOOGLE_CLIENT_ID`, etc.).
- **Paddle**: create your product and monthly/yearly prices in the Paddle dashboard first — you
  need the price IDs for the step in §7. Set `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`,
  `PADDLE_ENVIRONMENT` (`sandbox` until you're ready for real cards), and the frontend's
  `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` / `NEXT_PUBLIC_PADDLE_ENVIRONMENT` (this pair is baked into the
  admin panel's JS bundle at *build* time — see §6, not something you can change by just editing
  `.env` after the image is built). Full walkthrough: [`paddle.md`](paddle.md).
- **UddoktaPay**: `UDDOKTAPAY_API_KEY`, `UDDOKTAPAY_WEBHOOK_SECRET`, `UDDOKTAPAY_BASE_URL`.
- **SMTP**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_USE_TLS`,
  `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` — plus `SUPPORT_INBOX_EMAIL` for the admin panel's contact
  form, which sends through the same account.
- **Hosted S3** (only if offering Rolewire-hosted storage): `HOSTED_S3_ENDPOINT`, `HOSTED_S3_BUCKET`,
  `HOSTED_S3_REGION`, `HOSTED_S3_ACCESS_KEY`, `HOSTED_S3_SECRET_KEY`.

Webhook URLs (Paddle/UddoktaPay dashboards) need the domain to already resolve, so those get wired
up in §10 after the first boot — chicken-and-egg with a domain that isn't live yet otherwise.

---

## 6. Build and start

```bash
docker compose build --build-arg NEXT_PUBLIC_API_URL=https://app.rolewire.com \
                      --build-arg NEXT_PUBLIC_APP_URL=https://app.rolewire.com \
                      --build-arg NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN \
                      --build-arg NEXT_PUBLIC_PADDLE_ENVIRONMENT=production \
                      --build-arg NEXT_PUBLIC_SUPPORT_EMAIL=support@rolewire.com admin
docker compose up --build -d
```

The explicit `--build-arg` pass for `admin` isn't redundant with `.env`: Compose only reads the
`args:` interpolation (`${NEXT_PUBLIC_API_URL:-...}` in `docker-compose.yml`) from your shell
environment or a `.env` file *at the point you run `build`*, and those values get compiled into the
static JS bundle — changing `.env` afterward and restarting the container does nothing until you
rebuild. Simplest to just make sure the values are exported in your shell (or in `.env`, which
Compose does read automatically for interpolation) before running plain `docker compose up --build`.

Bringing the stack up runs migrations automatically — the `api` container's command is
`alembic upgrade head && uvicorn ...`, not a separate step. Watch it the first time:

```bash
docker compose logs -f api
```

---

## 7. Seed data

```bash
docker compose exec api python -m app.cli seed-plans
docker compose exec api python -m app.cli list-plans
```

`seed-plans` is idempotent — safe to re-run after changing `api/app/cli.py`'s `DEFAULT_PLANS`.

There's no CLI command for the Paddle price IDs (`plans.paddle_monthly_price_id` /
`paddle_yearly_price_id`) — set them once by hand after creating the prices in Paddle:

```bash
docker compose exec postgres psql -U rolewire -d rolewire -c \
  "UPDATE plans SET paddle_monthly_price_id = 'pri_xxx', paddle_yearly_price_id = 'pri_yyy' WHERE name = 'basic';"
```

Repeat per plan. Until this is set, upgrading to that plan via Paddle returns a `503` with a message
naming the missing price id (`app/services/billing.py`) rather than failing silently.

---

## 8. Create the platform superadmin

No self-signup endpoint exists for platform admins on purpose (`docs/spec.md` §platform) — this
script is the only way to create one:

```bash
docker compose exec api python -m app.scripts.create_platform_admin someone@rolewire.io
```

Prompts for a password (min 8 chars, entered twice to confirm). Fails with exit 1 if that email is
already a platform admin. This is the account you use to log into `/platform`, not a regular
tenant account.

---

## 9. Verify

```bash
curl -s https://app.rolewire.com/health          # {"status":"ok","environment":"prod"}
curl -s https://app.rolewire.com/health/ready     # includes a redis check
curl -s https://app.rolewire.com/v1/public/jobs   # {"items":[],"total":0} on a fresh install
```

Then open `https://app.rolewire.com/signup` in a browser and create the first tenant — that's the
real end-to-end check (Postgres write, RLS context, JWT cookie set, redirect to `/dashboard`).

---

## 10. Wire up webhook URLs

Now that the domain resolves, point each provider's webhook at this host:

| Provider | Webhook URL |
|---|---|
| Paddle | `https://app.rolewire.com/v1/webhooks/paddle` |
| UddoktaPay | `https://app.rolewire.com/v1/webhooks/uddoktapay` |

Both verify a provider signature before processing and are excluded from the JWT requirement
(`docs/spec.md` §12) — nothing else to authenticate on this end. Email has no webhook to wire up:
it's sent directly over SMTP, not through a provider that pushes delivery events back.

---

## 11. Monitoring

Add `https://app.rolewire.com/health` as an Uptime Kuma HTTP monitor, matching the existing infra
pattern (`docs/spec.md` §2). `/health/ready` is a stricter check if you want Redis outages to page
separately from the app being fully down.

---

## 12. Backups

Nothing here is automated yet — set up at minimum:

```bash
# Nightly dump, keep 14 days — adjust retention to taste, put it in cron on the host
docker compose exec -T postgres pg_dump -U rolewire rolewire | gzip > /backups/rolewire-$(date +%F).sql.gz
find /backups -name 'rolewire-*.sql.gz' -mtime +14 -delete
```

If you're on a provider with block-storage snapshots (DigitalOcean Volumes, etc.), a filesystem
snapshot of the `pgdata` volume's underlying disk is a reasonable second layer. `encrypted_credentials`
and `access_token_encrypted` columns are only decryptable with `ENCRYPTION_KEY` — back that up
somewhere the Postgres backup doesn't go (1Password/KMS), or a restored database is undecryptable.

---

## 13. Redeploying after a change

```bash
git pull
docker compose build --build-arg NEXT_PUBLIC_API_URL=https://app.rolewire.com \
                      --build-arg NEXT_PUBLIC_APP_URL=https://app.rolewire.com \
                      --build-arg NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN \
                      --build-arg NEXT_PUBLIC_PADDLE_ENVIRONMENT=production \
                      --build-arg NEXT_PUBLIC_SUPPORT_EMAIL=support@rolewire.com admin
docker compose build api worker
docker compose up -d
```

`docker compose up -d` recreates only the containers whose image or config changed, so `postgres`
and `redis` stay untouched. `api`'s new container re-runs `alembic upgrade head` before serving
traffic, so a new migration ships automatically — there's a brief window where the old `api`
container may still be draining a request against the pre-migration schema; at this project's
scale that's an acceptable trade-off, not something worth a blue-green setup for yet.

---

## 14. Rollback

```bash
git checkout <previous-tag-or-commit>
docker compose build api worker admin   # admin needs the --build-arg flags from §13 again
docker compose up -d
```

If the migration that shipped with the bad deploy needs reverting too:

```bash
docker compose exec api python -m alembic downgrade -1
```

Only do this if you're sure the migration is additive-safe to reverse — check the migration file
under `api/alembic/versions/` before running it against real data.

---

## 15. Troubleshooting

- **`api` container exits immediately on boot in prod** — almost always the config validator in
  `api/app/core/config.py` rejecting a short/default `JWT_SECRET`, missing `ENCRYPTION_KEY`, default
  `IP_HASH_SALT`, or `REDIS_ENABLED=false`. `docker compose logs api` prints exactly which.
- **OAuth login redirects to a JSON error page instead of `/dashboard`** — the callback hit the API
  directly instead of the admin app. Check the nginx regex location from §0 is present and ordered
  before the plain `/v1/admin/` block, and that `OAUTH_REDIRECT_BASE_URL` is the admin domain, not
  the API's.
- **Paddle checkout button does nothing** — `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` wasn't set at *build*
  time (§6), or that plan's `paddle_monthly_price_id`/`paddle_yearly_price_id` is still null (§7).
- **A tenant's public job endpoint suddenly returns `410 Gone`** — expected behavior once
  `tenants.status` flips to `suspended` after `GRACE_PERIOD_DAYS` of a missed UddoktaPay renewal
  (`docs/spec.md` §9.4), not a bug.
