"""Webhook signature verification and provider event handling (§9, §11, §12)."""

from __future__ import annotations

import json
import time
import uuid

from httpx import AsyncClient
from sqlalchemy import select

from app.core.db import get_sessionmaker
from app.models import Invoice, Plan, Subscription, Tenant
from app.services.signatures import sign_outbound
from tests.conftest import auth_headers


def paddle_headers(body: bytes, secret: str = "paddle-test-secret") -> dict[str, str]:
    timestamp, signature = sign_outbound(secret, body, int(time.time()))
    return {"Paddle-Signature": f"ts={timestamp};h1={signature}", "content-type": "application/json"}


async def _tenant_id(email: str, client: AsyncClient, company: str = "Acme Ltd") -> uuid.UUID:
    headers = await auth_headers(client, email=email, company=company)
    me = await client.get("/v1/admin/auth/me", headers=headers)
    return uuid.UUID(me.json()["tenant_id"])


async def test_paddle_rejects_unsigned_payloads(client: AsyncClient) -> None:
    response = await client.post("/v1/webhooks/paddle", json={"event_type": "subscription.created"})
    assert response.status_code == 401


async def test_paddle_rejects_tampered_body(client: AsyncClient) -> None:
    body = json.dumps({"event_type": "subscription.created"}).encode()
    headers = paddle_headers(body)
    response = await client.post(
        "/v1/webhooks/paddle", content=b'{"event_type":"subscription.canceled"}', headers=headers
    )
    assert response.status_code == 401


async def test_paddle_stale_timestamp_is_rejected(client: AsyncClient) -> None:
    body = json.dumps({"event_type": "subscription.created"}).encode()
    timestamp, signature = sign_outbound("paddle-test-secret", body, int(time.time()) - 3600)
    response = await client.post(
        "/v1/webhooks/paddle",
        content=body,
        headers={"Paddle-Signature": f"ts={timestamp};h1={signature}"},
    )
    assert response.status_code == 401


async def test_paddle_subscription_created_mirrors_state(
    client: AsyncClient, seed_plan: Plan
) -> None:
    tenant_id = await _tenant_id("paddle@acmecorp.io", client)
    event = {
        "event_type": "subscription.created",
        "data": {
            "id": "sub_123",
            "status": "active",
            "custom_data": {"tenant_id": str(tenant_id)},
            "items": [{"price": {"id": "pri_yearly_basic"}}],
            "current_billing_period": {"ends_at": "2030-01-01T00:00:00Z"},
        },
    }
    body = json.dumps(event).encode()
    response = await client.post("/v1/webhooks/paddle", content=body, headers=paddle_headers(body))
    assert response.status_code == 200

    async with get_sessionmaker()() as session:
        subscription = await session.scalar(
            select(Subscription).where(Subscription.tenant_id == tenant_id)
        )
        tenant = await session.scalar(select(Tenant).where(Tenant.id == tenant_id))
    assert subscription is not None
    assert subscription.provider == "paddle"
    assert subscription.provider_subscription_id == "sub_123"
    assert subscription.billing_cycle == "yearly"
    assert subscription.status == "active"
    assert tenant is not None and tenant.plan_id == seed_plan.id


async def test_paddle_transaction_completed_is_idempotent(
    client: AsyncClient, seed_plan: Plan
) -> None:
    tenant_id = await _tenant_id("paddletx@acmecorp.io", client)
    event = {
        "event_type": "transaction.completed",
        "data": {
            "id": "txn_1",
            "custom_data": {"tenant_id": str(tenant_id)},
            "details": {"totals": {"total": "900", "currency_code": "USD"}},
        },
    }
    body = json.dumps(event).encode()
    for _ in range(2):
        response = await client.post(
            "/v1/webhooks/paddle", content=body, headers=paddle_headers(body)
        )
        assert response.status_code == 200

    async with get_sessionmaker()() as session:
        invoices = list(await session.scalars(select(Invoice).where(Invoice.tenant_id == tenant_id)))
    assert len(invoices) == 1
    assert str(invoices[0].amount) == "9.00"
    assert invoices[0].currency == "USD"


async def test_uddoktapay_completed_payment_extends_period(
    client: AsyncClient, seed_plan: Plan
) -> None:
    tenant_id = await _tenant_id("bkash@acmecorp.io", client)
    payload = {
        "status": "COMPLETED",
        "amount": "990.00",
        "invoice_id": "inv_bd_1",
        "metadata": {
            "tenant_id": str(tenant_id),
            "plan_id": str(seed_plan.id),
            "billing_cycle": "monthly",
        },
    }
    response = await client.post(
        "/v1/webhooks/uddoktapay",
        json=payload,
        headers={"RT-UDDOKTAPAY-API-KEY": "uddoktapay-test-key"},
    )
    assert response.status_code == 200

    async with get_sessionmaker()() as session:
        subscription = await session.scalar(
            select(Subscription).where(Subscription.tenant_id == tenant_id)
        )
        invoice = await session.scalar(select(Invoice).where(Invoice.tenant_id == tenant_id))
    assert subscription is not None
    # No provider subscription object exists on this rail (§9.4).
    assert subscription.provider_subscription_id is None
    assert subscription.current_period_end is not None
    assert invoice is not None and invoice.currency == "BDT" and invoice.status == "paid"


async def test_uddoktapay_requires_api_key(client: AsyncClient) -> None:
    response = await client.post("/v1/webhooks/uddoktapay", json={"status": "COMPLETED"})
    assert response.status_code == 401
    wrong = await client.post(
        "/v1/webhooks/uddoktapay",
        json={"status": "COMPLETED"},
        headers={"RT-UDDOKTAPAY-API-KEY": "not-the-key"},
    )
    assert wrong.status_code == 401


