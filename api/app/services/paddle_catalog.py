"""Paddle Billing REST catalog client — lets an operator create a plan's Paddle product + prices
from the admin panel instead of pasting IDs copied from the Paddle dashboard.

This is the only code path in Rolewire that calls Paddle's REST API (and the only use of
``PADDLE_API_KEY``). Checkout and webhooks on the Paddle rail are client-side / signature-verified
and never touch this.
"""

from __future__ import annotations

import hashlib
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Literal

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Plan

_LIVE_BASE = "https://api.paddle.com"
_SANDBOX_BASE = "https://sandbox-api.paddle.com"

Interval = Literal["month", "year"]


class PaddleSyncError(Exception):
    """A Paddle REST call failed (or its credentials are missing). Carries Paddle's own error body
    so the caller can surface the specific detail rather than a generic message."""

    def __init__(self, message: str, *, status_code: int | None = None, body: Any = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def usd_to_cents_str(amount: Decimal) -> str:
    """``Decimal("8.99") -> "899"``. Decimal-only on purpose: ``float`` would make 10.0 round to
    ``"999"``/``"1001"`` depending on the platform. Quantize to 2 places, then scale by 100."""
    if not isinstance(amount, Decimal):
        raise TypeError("amount must be a Decimal, not float, to avoid rounding drift")
    cents = (amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) * 100).to_integral_value()
    return str(int(cents))


def idempotency_key(*parts: str) -> str:
    """Deterministic key so a retried / double-clicked create can't produce a duplicate."""
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def _extract_detail(body: Any) -> str | None:
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict):
            detail = error.get("detail") or error.get("code")
            if isinstance(detail, str):
                return detail
    return None


class PaddleCatalogClient:
    def __init__(self, *, api_key: str | None = None, environment: str | None = None) -> None:
        settings = get_settings()
        self._api_key = api_key if api_key is not None else settings.paddle_api_key
        env = environment or settings.paddle_environment
        self._base = _LIVE_BASE if env == "production" else _SANDBOX_BASE
        if not self._api_key:
            raise PaddleSyncError("PADDLE_API_KEY is not configured for this deployment")

    async def _post(self, path: str, payload: dict[str, Any], *, idem: str) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Paddle-Idempotency-Key": idem,
        }
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(f"{self._base}{path}", json=payload, headers=headers)

        body: Any
        try:
            body = response.json()
        except ValueError:
            body = response.text

        if response.status_code // 100 != 2:
            raise PaddleSyncError(
                _extract_detail(body) or f"Paddle {path} returned HTTP {response.status_code}",
                status_code=response.status_code,
                body=body,
            )
        return body.get("data", {}) if isinstance(body, dict) else {}

    async def create_product(
        self, *, plan_id: str, name: str, tax_category: str = "saas"
    ) -> dict[str, Any]:
        return await self._post(
            "/products",
            {"name": name, "tax_category": tax_category},
            idem=idempotency_key(plan_id, "product"),
        )

    async def create_price(
        self,
        *,
        plan_id: str,
        product_id: str,
        description: str,
        amount_usd: Decimal,
        interval: Interval,
        idem_extra: str | None = None,
    ) -> dict[str, Any]:
        # idem_extra keeps the reprice flow (which deliberately creates a *new* price under the
        # same product) from colliding with the initial-sync key for the same plan+interval.
        key_parts = [plan_id, interval, "price"]
        if idem_extra is not None:
            key_parts.append(idem_extra)
        return await self._post(
            "/prices",
            {
                "product_id": product_id,
                "description": description,
                "unit_price": {"amount": usd_to_cents_str(amount_usd), "currency_code": "USD"},
                "billing_cycle": {"interval": interval, "frequency": 1},
            },
            idem=idempotency_key(*key_parts),
        )


def _require_amount(plan: Plan, field: str) -> Decimal:
    value = getattr(plan, field)
    if value is None:
        raise PaddleSyncError(f"plan '{plan.name}' has no {field} set — set it before syncing")
    return Decimal(value)


async def sync_plan_to_paddle(
    session: AsyncSession, plan: Plan, *, client: PaddleCatalogClient | None = None
) -> Plan:
    """Create-if-missing only. Never overwrites an ID that is already set, so calling it again on a
    fully-synced plan makes zero Paddle calls and just returns the current state."""
    if plan.paddle_product_id and plan.paddle_monthly_price_id and plan.paddle_yearly_price_id:
        return plan

    client = client or PaddleCatalogClient()
    label = plan.name.replace("_", " ").title()

    if plan.paddle_product_id is None:
        product = await client.create_product(
            plan_id=str(plan.id), name=f"Rolewire {label}"
        )
        plan.paddle_product_id = product["id"]

    if plan.paddle_monthly_price_id is None:
        price = await client.create_price(
            plan_id=str(plan.id),
            product_id=plan.paddle_product_id,
            description=f"{label} — monthly",
            amount_usd=_require_amount(plan, "monthly_price_usd"),
            interval="month",
        )
        plan.paddle_monthly_price_id = price["id"]

    if plan.paddle_yearly_price_id is None:
        price = await client.create_price(
            plan_id=str(plan.id),
            product_id=plan.paddle_product_id,
            description=f"{label} — yearly",
            amount_usd=_require_amount(plan, "yearly_price_usd"),
            interval="year",
        )
        plan.paddle_yearly_price_id = price["id"]

    await session.flush()
    return plan


async def reprice_plan(
    session: AsyncSession,
    plan: Plan,
    *,
    new_monthly_price_usd: Decimal,
    new_yearly_price_usd: Decimal,
    client: PaddleCatalogClient | None = None,
) -> Plan:
    """Create fresh Paddle prices at the new amounts and point the plan at them.

    NOTE: existing subscriptions are NOT migrated. A customer already subscribed stays billed at
    their current price until they re-subscribe or upgrade; the old IDs are kept in
    ``paddle_*_price_id_previous`` so those subscribers can still be reported on. Building an active
    migration of subscribers onto the new price is a separate, future task — do not add it here.
    Paddle never lets you edit ``unit_price`` on an existing price, which is why this always
    creates a new one and never PATCHes.
    """
    if plan.paddle_product_id is None:
        raise PaddleSyncError(f"plan '{plan.name}' is not synced to Paddle yet — run sync first")

    client = client or PaddleCatalogClient()
    label = plan.name.replace("_", " ").title()

    monthly = await client.create_price(
        plan_id=str(plan.id),
        product_id=plan.paddle_product_id,
        description=f"{label} — monthly",
        amount_usd=new_monthly_price_usd,
        interval="month",
        idem_extra=usd_to_cents_str(new_monthly_price_usd),
    )
    yearly = await client.create_price(
        plan_id=str(plan.id),
        product_id=plan.paddle_product_id,
        description=f"{label} — yearly",
        amount_usd=new_yearly_price_usd,
        interval="year",
        idem_extra=usd_to_cents_str(new_yearly_price_usd),
    )

    plan.paddle_monthly_price_id_previous = plan.paddle_monthly_price_id
    plan.paddle_yearly_price_id_previous = plan.paddle_yearly_price_id
    plan.paddle_monthly_price_id = monthly["id"]
    plan.paddle_yearly_price_id = yearly["id"]
    # Keep the DB amounts and Paddle amounts in one transaction so they can't drift.
    plan.monthly_price_usd = new_monthly_price_usd
    plan.yearly_price_usd = new_yearly_price_usd

    await session.flush()
    return plan


__all__ = [
    "PaddleCatalogClient",
    "PaddleSyncError",
    "idempotency_key",
    "reprice_plan",
    "sync_plan_to_paddle",
    "usd_to_cents_str",
]
