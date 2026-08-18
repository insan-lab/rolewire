"""Billing rails: checkout initiation, renewal emulation, grace period (§9)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.db import get_sessionmaker
from app.models import Plan, Subscription, Tenant
from app.services import billing
from tests.conftest import auth_headers


async def _tenant(email: str, client: AsyncClient) -> uuid.UUID:
    headers = await auth_headers(client, email=email)
    me = await client.get("/v1/admin/auth/me", headers=headers)
    return uuid.UUID(me.json()["tenant_id"])


def test_add_cycle_advances_monthly_and_yearly() -> None:
    start = datetime(2025, 1, 1, tzinfo=UTC)
    assert billing.add_cycle(start, "monthly") == start + timedelta(days=30)
    assert billing.add_cycle(start, "yearly") == start + timedelta(days=365)


async def test_signup_assigns_the_cheapest_plan(client: AsyncClient, seed_plan: Plan) -> None:
    headers = await auth_headers(client, email="plan@acmecorp.io")
    overview = await client.get("/v1/admin/billing", headers=headers)
    assert overview.status_code == 200
    body = overview.json()
    assert body["plan"]["name"] == "basic"
    assert body["subscription"] is None
    assert body["tenant_status"] == "active"


async def test_paddle_upgrade_returns_client_side_checkout_instructions(
    client: AsyncClient, seed_plan: Plan
) -> None:
    headers = await auth_headers(client, email="upgrade@acmecorp.io")
    response = await client.post(
        "/v1/admin/billing/upgrade",
        json={"plan_id": str(seed_plan.id), "billing_cycle": "monthly", "provider": "paddle"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "paddle"
    assert body["checkout_url"] is None
    assert "pri_monthly_basic" in body["note"]


async def test_uddoktapay_upgrade_requires_configuration(
    client: AsyncClient, seed_plan: Plan
) -> None:
    headers = await auth_headers(client, email="bdupgrade@acmecorp.io")
    response = await client.post(
        "/v1/admin/billing/upgrade",
        json={"plan_id": str(seed_plan.id), "billing_cycle": "monthly", "provider": "uddoktapay"},
        headers=headers,
    )
    # No UddoktaPay base URL is configured in the test environment.
    assert response.status_code == 503


async def test_upgrade_with_unknown_plan_is_404(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="noplan@acmecorp.io")
    response = await client.post(
        "/v1/admin/billing/upgrade",
        json={"plan_id": str(uuid.uuid4()), "billing_cycle": "monthly", "provider": "paddle"},
        headers=headers,
    )
    assert response.status_code == 404


async def test_grace_period_moves_past_due_then_suspends(
    client: AsyncClient, seed_plan: Plan, settings
) -> None:
    tenant_id = await _tenant("grace@acmecorp.io", client)
    now = datetime.now(UTC)

    async with get_sessionmaker()() as session:
        session.add(
            Subscription(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                plan_id=seed_plan.id,
                provider="uddoktapay",
                billing_cycle="monthly",
                status="active",
                current_period_end=now - timedelta(days=1),
            )
        )
        await session.commit()

    async with get_sessionmaker()() as session:
        result = await billing.apply_grace_period_rules(session, now=now)
        await session.commit()
    assert result == {"past_due": 1, "suspended": 0}

    async with get_sessionmaker()() as session:
        tenant = await session.scalar(select(Tenant).where(Tenant.id == tenant_id))
        assert tenant is not None and tenant.status == "past_due"

    # Past the configured grace window the tenant is suspended.
    later = now + timedelta(days=settings.grace_period_days + 1)
    async with get_sessionmaker()() as session:
        result = await billing.apply_grace_period_rules(session, now=later)
        await session.commit()
    assert result["suspended"] == 1

    async with get_sessionmaker()() as session:
        tenant = await session.scalar(select(Tenant).where(Tenant.id == tenant_id))
    assert tenant is not None and tenant.status == "suspended"


async def test_plan_without_bdt_price_is_a_config_error(client: AsyncClient) -> None:
    async with get_sessionmaker()() as session:
        plan = Plan(id=uuid.uuid4(), name="usd-only", monthly_price_usd=19, features={})
        session.add(plan)
        await session.commit()
        plan_id = plan.id

    headers = await auth_headers(client, email="usdonly@acmecorp.io")
    response = await client.post(
        "/v1/admin/billing/upgrade",
        json={"plan_id": str(plan_id), "billing_cycle": "monthly", "provider": "uddoktapay"},
        headers=headers,
    )
    assert response.status_code == 503


def test_price_lookup_raises_for_missing_currency() -> None:
    plan = Plan(id=uuid.uuid4(), name="x", monthly_price_usd=9, features={})
    with pytest.raises(billing.BillingConfigError):
        billing._price_for(plan, "monthly", "bdt")
