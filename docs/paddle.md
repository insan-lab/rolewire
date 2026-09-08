# Rolewire — Paddle Setup Guide

**Companion to:** [`deploy.md`](deploy.md) §5/§7/§9, [`spec.md`](spec.md) §9.3
**Scope:** getting Paddle Billing working end-to-end for the global (non-Bangladesh) payment rail —
dashboard setup, env vars, wiring price IDs into `plans`, and the webhook.

---

## 1. How Rolewire uses Paddle

- **Paddle Billing** (not "Paddle Classic"). Checkout runs client-side via **Paddle.js v2**, opened
  as an overlay from the admin panel's billing/upgrade page
  (`admin/src/components/app/billing-upgrade.tsx`). Rolewire never collects card data.
- The API's role on checkout is just to hand back the price id + `tenant_id` for Paddle.js to open
  with (`POST /v1/admin/billing/upgrade` → `app/services/billing.py:start_checkout`). No server-side
  call to the Paddle API happens here — the webhook signature is what authenticates Paddle back to
  Rolewire.
- `PADDLE_API_KEY` is used by exactly one path: `app/services/paddle_catalog.py`, called from the
  superadmin **Plans** page to create a plan's Paddle product + prices ("Sync to Paddle") and to
  create replacement prices on a price change ("Change price" → `/reprice`). See §5.
- **`POST /v1/webhooks/paddle`** (`app/routers/webhooks.py`) is the source of truth after that: it
  verifies the `Paddle-Signature` header, then handles `subscription.*` events (upserts the
  `subscriptions` row and flips `tenants.plan_id`/`status`) and `transaction.completed` /
  `transaction.payment_failed` (writes an `invoices` row). This route sits outside the admin JWT
  requirement — signature verification is the auth.
- **Routing to Paddle vs. UddoktaPay** is per-tenant, not per-request: `tenants.region == "BD"` sends
  a tenant to UddoktaPay; everything else (including a brand-new tenant with `region IS NULL`) goes
  to Paddle. `region` gets set to `"GLOBAL"` the first time that tenant starts a Paddle checkout.

---

## 2. Paddle dashboard: account

1. Sign up at [paddle.com](https://paddle.com) (or log into an existing account) and leave it in
   **Sandbox** mode for everything below until you're ready to take real cards — the sandbox/live
   toggle is in the top-left of the dashboard.

You do **not** need to create products or prices by hand — the superadmin Plans page does that via
the Paddle REST API (§5). Just make sure `PADDLE_API_KEY` (§3) is set.

---

## 3. Get your API credentials

Dashboard → **Developer tools → Authentication**:

- **API key** — server-side secret. Not currently called by Rolewire's request paths (see §1), but
  set it anyway: `PADDLE_API_KEY`.
- **Client-side token** — safe to expose in the browser; this is what Paddle.js initializes with.
  Set it as `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.

Dashboard → **Developer tools → Notifications → New destination**:

- URL: `https://<your-domain>/v1/webhooks/paddle` (this has to already resolve — see §6 if you're
  doing this before first boot).
- Events to subscribe: `subscription.created`, `subscription.updated`, `subscription.canceled`,
  `transaction.completed`, `transaction.payment_failed` — this is the exact set
  `app/routers/webhooks.py` understands; other event types are accepted and acknowledged but ignored.
- After creating it, open the destination and copy its **secret key** (`pdl_ntfset_...`) —
  that's `PADDLE_WEBHOOK_SECRET`, used to verify the `Paddle-Signature: ts=...;h1=...` HMAC on every
  delivery (`app/services/signatures.py:verify_paddle`).

---

## 4. Environment variables

Backend (`api`, read by `app/core/config.py`):

```ini
PADDLE_API_KEY=pdl_...
PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
PADDLE_ENVIRONMENT=sandbox        # or "production"
```

None of these are required for the app to boot — Paddle degrades to a `503 plan has no Paddle price
id configured` / signature error on the routes that need it, everything else keeps working.

Frontend (`admin`) — **build-time only**, baked into the static JS bundle, not readable from a
running container's `.env`:

```ini
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_...     # or live_... in production
NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox        # or "production"
```

If you're on the Docker Compose deploy from `deploy.md`, these two get passed as `--build-arg`s at
`docker compose build` time (§6 there) — editing `.env` after the image is already built does
nothing until you rebuild `admin`.

---

## 5. Sync plans to Paddle

Run `seed-plans` once to create the plan rows, then go to the **superadmin panel → Plans**
(`/platform/plans`):

```bash
docker compose exec api python -m app.cli seed-plans   # if you haven't already
```

- **Sync to Paddle** (`POST /v1/admin/platform/plans/{id}/sync-paddle`) — creates one Paddle
  product + a monthly and a yearly price matching `plans.monthly_price_usd` / `yearly_price_usd`,
  and stores `paddle_product_id` / `paddle_monthly_price_id` / `paddle_yearly_price_id`. It is
  create-if-missing: clicking it again on a fully-synced plan makes zero Paddle calls. Each create
  carries a deterministic `Paddle-Idempotency-Key`, so a double-click can't produce duplicates.
- **Change price** (`POST .../reprice`) — Paddle price amounts are immutable, so a price change
  means new price objects. This creates them under the existing product, moves the old ids into
  `paddle_*_price_id_previous`, and updates the USD amounts on the plan row in the same
  transaction. **Existing subscribers are not migrated** — they stay on their current price until
  they re-subscribe; the previous ids are kept so they can be reported on.

Verify against the Paddle dashboard (Catalog → Products) and:

```bash
docker compose exec api python -m app.cli list-plans
```

Until a plan is synced, `start_checkout` raises `BillingConfigError` and the upgrade endpoint
returns `503` — expected for a plan you haven't synced yet.

A manual escape hatch still exists (`PATCH /v1/admin/platform/plans/{id}` with
`paddle_monthly_price_id` / `paddle_yearly_price_id`, blank clears) for fixing a bad id without a
re-sync; it is not exposed in the UI.

---

## 6. Local development / testing before you have a public domain

Paddle needs to reach your webhook over the internet, so `localhost` alone doesn't work for that
part. Two options:

- **Test the checkout flow without webhooks**: Paddle.js overlay checkout works fine against
  `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` from a sandbox account even on `localhost` — you just won't see
  the resulting `subscriptions`/`invoices` rows appear until a webhook lands.
- **Tunnel the webhook**: run `ngrok http 8000` (or `cloudflared tunnel`) pointing at the `api`
  container's port, and use the `https://*.ngrok.io/v1/webhooks/paddle` URL as the notification
  destination in the sandbox dashboard (§3). Swap it for the real domain before going live.

Sandbox test cards (any expiry/CVC in the future): `4242 4242 4242 4242` (success),
`4000 0000 0000 0002` (declined) — see Paddle's own sandbox docs for the full list, they change
occasionally.

---

## 7. Verify end-to-end

1. Sign up a tenant, go to `/billing/upgrade`.
2. Pick a non-BD plan — the Paddle.js overlay should open (if it doesn't, see Troubleshooting).
3. Pay with a sandbox test card.
4. Paddle fires `transaction.completed` and `subscription.created` at your webhook. Confirm:
   ```bash
   docker compose exec postgres psql -U rolewire -d rolewire -c \
     "SELECT provider, status, current_period_end FROM subscriptions ORDER BY created_at DESC LIMIT 1;"
   docker compose exec postgres psql -U rolewire -d rolewire -c \
     "SELECT provider, status, amount, currency FROM invoices ORDER BY created_at DESC LIMIT 1;"
   ```
5. The tenant's `plan_id`/`status` on the `tenants` row should now match, and the admin panel's
   billing page should reflect the new plan on next load.

---

## 8. Troubleshooting

- **Checkout button does nothing** — `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` wasn't set at *build* time
  (§4), or the browser console shows Paddle.js failed to load (ad blockers sometimes catch
  `cdn.paddle.com`).
- **Checkout opens but the upgrade call 503s first** — that plan's `paddle_monthly_price_id` /
  `paddle_yearly_price_id` is still null (§5).
- **Webhook returns 401** — `PADDLE_WEBHOOK_SECRET` doesn't match the notification destination's
  secret (§3), or the timestamp in `Paddle-Signature` is more than 5 minutes old
  (`verify_paddle`'s `tolerance_seconds=300` — usually a clock-skew issue on the host, not a real
  attack).
- **Webhook returns 200 but nothing changed** — check the response body: `{"status": "ignored",
  "reason": "unknown tenant"}` means `custom_data.tenant_id` on the Paddle event didn't match any
  tenant (the checkout overlay always passes it — see `billing-upgrade.tsx`'s `customData:
  {tenant_id: ...}` — so this usually means the checkout was opened without going through Rolewire's
  upgrade flow first). `"reason": "unknown paddle price id"` means §5 wasn't done for the price the
  customer actually bought.
- **A subscription shows `past_due` and won't clear** — that's the worker's grace-period sweep
  (`billing.apply_grace_period_rules`, `spec.md` §9.4) reacting to `current_period_end` from the last
  webhook, not a Paddle-side issue; a fresh `subscription.updated` webhook with a later
  `current_billing_period.ends_at` clears it.
