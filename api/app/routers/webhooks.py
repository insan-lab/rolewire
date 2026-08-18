"""Provider webhooks (§12).

These routes are deliberately outside the admin JWT requirement — signature verification *is* the
authentication. Every handler is idempotent because all three providers retry.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import set_auth_context, set_tenant_context
from app.models import Plan, Subscription, Tenant, User
from app.routers.deps import DbSession
from app.services import billing
from app.services.signatures import SignatureError, verify_brevo, verify_paddle, verify_uddoktapay

router = APIRouter(prefix="/v1/webhooks", tags=["webhooks"])

PADDLE_SUBSCRIPTION_STATUS = {
    "active": "active",
    "trialing": "active",
    "past_due": "past_due",
    "paused": "paused",
    "canceled": "canceled",
}


def _bad_signature(exc: SignatureError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))


def _as_decimal(value: Any, *, scale: Decimal = Decimal(1)) -> Decimal:
    try:
        return (Decimal(str(value)) * scale).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError):
        return Decimal("0.00")


def _parse_ts(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


async def _tenant_by_id(session: DbSession, raw_id: Any) -> Tenant | None:
    try:
        tenant_id = uuid.UUID(str(raw_id))
    except (ValueError, TypeError):
        return None
    tenant = await session.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if tenant is not None:
        await set_tenant_context(session, tenant.id)
    return tenant


async def _plan_by_paddle_price(session: DbSession, price_id: str | None) -> Plan | None:
    if not price_id:
        return None
    return await session.scalar(
        select(Plan).where(
            (Plan.paddle_monthly_price_id == price_id) | (Plan.paddle_yearly_price_id == price_id)
        )
    )


@router.post("/paddle", summary="Paddle Billing events")
async def paddle_webhook(
    request: Request,
    session: DbSession,
    paddle_signature: str | None = Header(default=None, alias="Paddle-Signature"),
) -> dict[str, str]:
    body = await request.body()
    try:
        verify_paddle(
            secret=get_settings().paddle_webhook_secret,
            signature_header=paddle_signature,
            body=body,
        )
    except SignatureError as exc:
        raise _bad_signature(exc) from exc

    event = await request.json()
    event_type = str(event.get("event_type", ""))
    data: dict[str, Any] = event.get("data") or {}
    custom = data.get("custom_data") or {}

    tenant = await _tenant_by_id(session, custom.get("tenant_id"))
    if tenant is None:
        # Unknown tenant: acknowledge so Paddle stops retrying, but do not silently create state.
        return {"status": "ignored", "reason": "unknown tenant"}

    if event_type.startswith("subscription."):
        items = data.get("items") or []
        price_id = None
        if items and isinstance(items[0], dict):
            price_id = (items[0].get("price") or {}).get("id")
        plan = await _plan_by_paddle_price(session, price_id)
        if plan is None:
            return {"status": "ignored", "reason": "unknown paddle price id"}

        cycle = "yearly" if plan.paddle_yearly_price_id == price_id else "monthly"
        mapped = PADDLE_SUBSCRIPTION_STATUS.get(str(data.get("status")), "active")
        if event_type == "subscription.canceled":
            mapped = "canceled"
        period = (data.get("current_billing_period") or {}).get("ends_at")

        await billing.upsert_subscription(
            session,
            tenant_id=tenant.id,
            plan_id=plan.id,
            provider="paddle",
            billing_cycle=cycle,
            status=mapped,
            provider_subscription_id=str(data.get("id")) if data.get("id") else None,
            current_period_end=_parse_ts(period),
        )
        return {"status": "ok", "event": event_type}

    if event_type in ("transaction.completed", "transaction.payment_failed"):
        totals = ((data.get("details") or {}).get("totals")) or {}
        subscription = await session.scalar(
            select(Subscription)
            .where(Subscription.tenant_id == tenant.id, Subscription.provider == "paddle")
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )
        await billing.record_invoice(
            session,
            tenant_id=tenant.id,
            subscription_id=subscription.id if subscription else None,
            provider="paddle",
            provider_invoice_id=str(data.get("id")) if data.get("id") else None,
            # Paddle reports money in minor units.
            amount=_as_decimal(totals.get("total", 0), scale=Decimal("0.01")),
            currency=str(totals.get("currency_code") or "USD"),
            status="paid" if event_type == "transaction.completed" else "failed",
            raw_payload=event,
        )
        return {"status": "ok", "event": event_type}

    return {"status": "ignored", "reason": f"unhandled event {event_type}"}


@router.post("/uddoktapay", summary="UddoktaPay payment callback")
async def uddoktapay_webhook(
    request: Request,
    session: DbSession,
    api_key: str | None = Header(default=None, alias="RT-UDDOKTAPAY-API-KEY"),
) -> dict[str, str]:
    settings = get_settings()
    try:
        verify_uddoktapay(
            api_key=settings.uddoktapay_webhook_secret or settings.uddoktapay_api_key,
            provided_key=api_key,
        )
    except SignatureError as exc:
        raise _bad_signature(exc) from exc

    event = await request.json()
    metadata = event.get("metadata") or {}
    tenant = await _tenant_by_id(session, metadata.get("tenant_id"))
    if tenant is None:
        return {"status": "ignored", "reason": "unknown tenant"}

    plan = None
    try:
        plan = await session.scalar(select(Plan).where(Plan.id == uuid.UUID(str(metadata.get("plan_id")))))
    except (ValueError, TypeError):
        plan = None
    if plan is None:
        return {"status": "ignored", "reason": "unknown plan"}

    billing_cycle = str(metadata.get("billing_cycle") or "monthly")
    paid = str(event.get("status", "")).upper() == "COMPLETED"

    if paid:
        # No provider subscription object exists on this rail: Rolewire owns renewal state.
        period_end = billing.add_cycle(datetime.now(UTC), billing_cycle)
        subscription = await billing.upsert_subscription(
            session,
            tenant_id=tenant.id,
            plan_id=plan.id,
            provider="uddoktapay",
            billing_cycle=billing_cycle,
            status="active",
            current_period_end=period_end,
        )
    else:
        subscription = await session.scalar(
            select(Subscription)
            .where(Subscription.tenant_id == tenant.id, Subscription.provider == "uddoktapay")
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )

    await billing.record_invoice(
        session,
        tenant_id=tenant.id,
        subscription_id=subscription.id if subscription else None,
        provider="uddoktapay",
        provider_invoice_id=str(event.get("invoice_id")) if event.get("invoice_id") else None,
        amount=_as_decimal(event.get("amount", 0)),
        currency="BDT",
        status="paid" if paid else "failed",
        raw_payload=event,
    )
    return {"status": "ok", "paid": str(paid).lower()}


@router.post("/brevo", summary="Brevo delivery events")
async def brevo_webhook(
    request: Request,
    session: DbSession,
    token: str | None = Header(default=None, alias="X-Brevo-Webhook-Token"),
) -> dict[str, int]:
    body = await request.body()
    try:
        verify_brevo(
            secret=get_settings().brevo_webhook_secret, provided_token=token, body=body
        )
    except SignatureError as exc:
        raise _bad_signature(exc) from exc

    payload = await request.json()
    events = payload if isinstance(payload, list) else [payload]
    undeliverable = {"hard_bounce", "blocked", "spam", "invalid_email", "unsubscribed"}
    updated = 0

    for entry in events:
        if not isinstance(entry, dict):
            continue
        email = entry.get("email")
        event_name = str(entry.get("event", "")).lower()
        if not email or event_name not in undeliverable:
            continue
        await set_auth_context(session)
        user = await session.scalar(select(User).where(User.email == str(email).lower()))
        if user is None:
            continue
        await set_tenant_context(session, user.tenant_id)
        user.email_deliverable = False
        updated += 1

    return {"updated": updated}


__all__ = ["router"]
