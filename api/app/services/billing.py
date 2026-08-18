"""Billing logic for both payment rails (§9).

Paddle owns subscription state on the global rail: checkout happens in Paddle.js/hosted checkout
and Rolewire mirrors state from webhooks. UddoktaPay has no subscription object, so renewals are
emulated locally — a successful charge extends ``current_period_end`` and a daily worker sweep
sends renewal links and applies the grace-period → suspension transition.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Invoice, Plan, Subscription, Tenant, User
from app.schemas.billing import UpgradeCheckout


class BillingError(Exception):
    pass


class BillingConfigError(BillingError):
    """Provider credentials or price ids are missing for this deployment."""


def add_cycle(start: datetime, billing_cycle: str) -> datetime:
    """Advance a period end by one billing cycle (30/365 days — no calendar-month drift games)."""
    delta = timedelta(days=365) if billing_cycle == "yearly" else timedelta(days=30)
    return start + delta


def _price_for(plan: Plan, billing_cycle: str, currency: str) -> Decimal:
    field = f"{billing_cycle}_price_{currency.lower()}"
    amount = getattr(plan, field, None)
    if amount is None:
        raise BillingConfigError(f"plan '{plan.name}' has no {field} configured")
    return Decimal(amount)


async def start_checkout(
    session: AsyncSession,
    *,
    tenant: Tenant,
    user: User,
    plan: Plan,
    provider: str,
    billing_cycle: str,
) -> UpgradeCheckout:
    settings = get_settings()

    if provider == "paddle":
        price_id = (
            plan.paddle_yearly_price_id if billing_cycle == "yearly" else plan.paddle_monthly_price_id
        )
        if not price_id:
            raise BillingConfigError(
                f"plan '{plan.name}' has no Paddle {billing_cycle} price id configured"
            )
        tenant.region = tenant.region or "GLOBAL"
        tenant.payment_provider = "paddle"
        # Paddle Billing checkout is opened client-side with the price id; Rolewire never
        # collects card data and the subscription row is created from the webhook.
        return UpgradeCheckout(
            provider="paddle",
            checkout_url=None,
            plan_id=plan.id,
            billing_cycle=billing_cycle,
            note=(
                f"Open Paddle.js checkout with price_id={price_id} and "
                f"custom_data.tenant_id={tenant.id}"
            ),
        )

    if provider == "uddoktapay":
        if not (settings.uddoktapay_api_key and settings.uddoktapay_base_url):
            raise BillingConfigError("uddoktapay api key/base url are not configured")
        amount = _price_for(plan, billing_cycle, "bdt")
        tenant.region = "BD"
        tenant.payment_provider = "uddoktapay"
        payload = {
            "full_name": tenant.name,
            "email": user.email,
            "amount": str(amount),
            "metadata": {
                "tenant_id": str(tenant.id),
                "plan_id": str(plan.id),
                "billing_cycle": billing_cycle,
            },
            "redirect_url": f"{settings.app_base_url.rstrip('/')}/billing?status=success",
            "cancel_url": f"{settings.app_base_url.rstrip('/')}/billing?status=cancelled",
            "webhook_url": f"{settings.oauth_redirect_base_url.rstrip('/')}/v1/webhooks/uddoktapay",
        }
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{settings.uddoktapay_base_url.rstrip('/')}/api/checkout-v2",
                headers={
                    "RT-UDDOKTAPAY-API-KEY": settings.uddoktapay_api_key,
                    "accept": "application/json",
                },
                json=payload,
            )
        if response.status_code >= 300:
            raise BillingError(f"uddoktapay checkout failed ({response.status_code})")
        payment_url = response.json().get("payment_url")
        if not payment_url:
            raise BillingError("uddoktapay did not return a payment_url")
        return UpgradeCheckout(
            provider="uddoktapay",
            checkout_url=payment_url,
            plan_id=plan.id,
            billing_cycle=billing_cycle,
            note="bKash/Nagad checkout; renewal is emulated by Rolewire (§9.4)",
        )

    raise BillingError(f"unsupported payment provider '{provider}'")


async def upsert_subscription(
    session: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    plan_id: uuid.UUID,
    provider: str,
    billing_cycle: str,
    status: str,
    provider_subscription_id: str | None = None,
    current_period_end: datetime | None = None,
) -> Subscription:
    subscription: Subscription | None = None
    if provider_subscription_id:
        subscription = await session.scalar(
            select(Subscription).where(
                Subscription.provider == provider,
                Subscription.provider_subscription_id == provider_subscription_id,
            )
        )
    if subscription is None:
        subscription = await session.scalar(
            select(Subscription)
            .where(Subscription.tenant_id == tenant_id, Subscription.provider == provider)
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )

    if subscription is None:
        subscription = Subscription(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            plan_id=plan_id,
            provider=provider,
            billing_cycle=billing_cycle,
            status=status,
            provider_subscription_id=provider_subscription_id,
            current_period_end=current_period_end,
        )
        session.add(subscription)
    else:
        subscription.plan_id = plan_id
        subscription.billing_cycle = billing_cycle
        subscription.status = status
        if provider_subscription_id:
            subscription.provider_subscription_id = provider_subscription_id
        if current_period_end:
            subscription.current_period_end = current_period_end

    tenant = await session.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if tenant is not None:
        tenant.plan_id = plan_id
        tenant.billing_cycle = billing_cycle
        tenant.payment_provider = provider
        if status == "active":
            tenant.status = "active"
        elif status == "past_due":
            tenant.status = "past_due"
    await session.flush()
    return subscription


async def record_invoice(
    session: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    subscription_id: uuid.UUID | None,
    provider: str,
    provider_invoice_id: str | None,
    amount: Decimal,
    currency: str,
    status: str,
    raw_payload: dict[str, Any] | None = None,
) -> Invoice | None:
    """Idempotent invoice write — providers retry webhooks, so duplicates are expected."""
    if provider_invoice_id:
        existing = await session.scalar(
            select(Invoice).where(
                Invoice.provider == provider, Invoice.provider_invoice_id == provider_invoice_id
            )
        )
        if existing is not None:
            return None
    invoice = Invoice(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        subscription_id=subscription_id,
        provider=provider,
        provider_invoice_id=provider_invoice_id,
        amount=amount,
        currency=currency,
        status=status,
        raw_payload=raw_payload,
    )
    session.add(invoice)
    await session.flush()
    return invoice


async def apply_grace_period_rules(session: AsyncSession, *, now: datetime | None = None) -> dict[str, int]:
    """Move expired subscriptions to ``past_due`` and suspend tenants past the grace window."""
    settings = get_settings()
    moment = now or datetime.now(UTC)
    grace_cutoff = moment - timedelta(days=settings.grace_period_days)
    past_due = 0
    suspended = 0

    expired = await session.scalars(
        select(Subscription).where(
            Subscription.status == "active",
            Subscription.current_period_end.is_not(None),
            Subscription.current_period_end < moment,
        )
    )
    for subscription in expired:
        subscription.status = "past_due"
        tenant = await session.scalar(select(Tenant).where(Tenant.id == subscription.tenant_id))
        if tenant is not None:
            tenant.status = "past_due"
        past_due += 1

    stale = await session.scalars(
        select(Subscription).where(
            Subscription.status == "past_due",
            Subscription.current_period_end.is_not(None),
            Subscription.current_period_end < grace_cutoff,
        )
    )
    for subscription in stale:
        tenant = await session.scalar(select(Tenant).where(Tenant.id == subscription.tenant_id))
        if tenant is not None and tenant.status != "suspended":
            tenant.status = "suspended"
            suspended += 1

    await session.flush()
    return {"past_due": past_due, "suspended": suspended}
