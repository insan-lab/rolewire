from __future__ import annotations

from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.db import get_sessionmaker
from app.models import Plan
from app.services import paddle_catalog
from app.services.paddle_catalog import (
    idempotency_key,
    reprice_plan,
    sync_plan_to_paddle,
    usd_to_cents_str,
)
from tests.test_platform_updates import _platform_headers

# ── cents conversion ─────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("amount", "expected"),
    [
        (Decimal("8.99"), "899"),
        (Decimal("149.99"), "14999"),
        (Decimal("10.0"), "1000"),
        (Decimal("10.00"), "1000"),
        (Decimal("0.01"), "1"),
    ],
)
def test_usd_to_cents_str(amount: Decimal, expected: str) -> None:
    assert usd_to_cents_str(amount) == expected


def test_usd_to_cents_str_rejects_float() -> None:
    with pytest.raises(TypeError):
        usd_to_cents_str(10.0)  # type: ignore[arg-type]


# ── idempotency key ──────────────────────────────────────────────────────────


def test_idempotency_key_stable_and_scoped() -> None:
    assert idempotency_key("plan-1", "month", "price") == idempotency_key("plan-1", "month", "price")
    assert idempotency_key("plan-1", "month", "price") != idempotency_key(
        "plan-1", "year", "price"
    )
    assert idempotency_key("plan-1", "product") != idempotency_key("plan-2", "product")


# ── fake client ──────────────────────────────────────────────────────────────


class FakeCatalogClient:
    """Counts calls so tests can assert the create-if-missing contract."""

    instances: list[FakeCatalogClient] = []

    def __init__(self, **_kwargs: object) -> None:
        self.products: list[tuple[str, str]] = []
        self.prices: list[tuple[str, str, str, str | None]] = []
        FakeCatalogClient.instances.append(self)

    async def create_product(self, *, plan_id: str, name: str, tax_category: str = "saas") -> dict:
        self.products.append((plan_id, name))
        return {"id": f"pro_{len(self.products)}"}

    async def create_price(
        self,
        *,
        plan_id: str,
        product_id: str,
        description: str,
        amount_usd: Decimal,
        interval: str,
        idem_extra: str | None = None,
    ) -> dict:
        self.prices.append((plan_id, interval, usd_to_cents_str(amount_usd), idem_extra))
        return {"id": f"pri_{interval}_{len(self.prices)}"}


async def _get_plan(plan_id) -> Plan:
    async with get_sessionmaker()() as session:
        return await session.scalar(select(Plan).where(Plan.id == plan_id))  # type: ignore[return-value]


# ── sync ─────────────────────────────────────────────────────────────────────


async def test_sync_creates_one_product_two_prices_then_is_noop(seed_plan: Plan) -> None:
    fake = FakeCatalogClient()

    async with get_sessionmaker()() as session:
        plan = await session.get(Plan, seed_plan.id)
        assert plan is not None
        plan.paddle_product_id = None
        plan.paddle_monthly_price_id = None
        plan.paddle_yearly_price_id = None
        await session.commit()

    async with get_sessionmaker()() as session:
        plan = await session.get(Plan, seed_plan.id)
        await sync_plan_to_paddle(session, plan, client=fake)  # type: ignore[arg-type]
        await session.commit()

    assert len(fake.products) == 1
    assert len(fake.prices) == 2
    assert {p[1] for p in fake.prices} == {"month", "year"}

    refreshed = await _get_plan(seed_plan.id)
    assert refreshed.paddle_product_id == "pro_1"
    assert refreshed.paddle_monthly_price_id == "pri_month_1"
    assert refreshed.paddle_yearly_price_id == "pri_year_2"

    # Second run: fully synced → zero further calls.
    fake2 = FakeCatalogClient()
    async with get_sessionmaker()() as session:
        plan = await session.get(Plan, seed_plan.id)
        await sync_plan_to_paddle(session, plan, client=fake2)  # type: ignore[arg-type]
        await session.commit()
    assert fake2.products == []
    assert fake2.prices == []


async def test_sync_endpoint_second_call_makes_no_paddle_calls(
    client: AsyncClient, seed_plan: Plan, monkeypatch: pytest.MonkeyPatch
) -> None:
    async with get_sessionmaker()() as session:
        plan = await session.get(Plan, seed_plan.id)
        assert plan is not None
        plan.paddle_product_id = None
        plan.paddle_monthly_price_id = None
        plan.paddle_yearly_price_id = None
        await session.commit()

    FakeCatalogClient.instances.clear()
    monkeypatch.setattr(paddle_catalog, "PaddleCatalogClient", FakeCatalogClient)
    headers = await _platform_headers(client)

    first = await client.post(
        f"/v1/admin/platform/plans/{seed_plan.id}/sync-paddle", headers=headers
    )
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["paddle_product_id"] == "pro_1"
    assert body["paddle_monthly_price_id"] and body["paddle_yearly_price_id"]

    second = await client.post(
        f"/v1/admin/platform/plans/{seed_plan.id}/sync-paddle", headers=headers
    )
    assert second.status_code == 200
    total_calls = sum(len(i.products) + len(i.prices) for i in FakeCatalogClient.instances)
    assert total_calls == 3  # 1 product + 2 prices from the first call only


# ── reprice ──────────────────────────────────────────────────────────────────


async def test_reprice_keeps_previous_ids_and_updates_amounts(seed_plan: Plan) -> None:
    fake = FakeCatalogClient()
    async with get_sessionmaker()() as session:
        plan = await session.get(Plan, seed_plan.id)
        plan.paddle_product_id = "pro_existing"
        await session.commit()

    async with get_sessionmaker()() as session:
        plan = await session.get(Plan, seed_plan.id)
        old_monthly, old_yearly = plan.paddle_monthly_price_id, plan.paddle_yearly_price_id
        await reprice_plan(
            session,
            plan,
            new_monthly_price_usd=Decimal("12.00"),
            new_yearly_price_usd=Decimal("120.00"),
            client=fake,  # type: ignore[arg-type]
        )
        await session.commit()

    refreshed = await _get_plan(seed_plan.id)
    assert refreshed.paddle_monthly_price_id_previous == old_monthly
    assert refreshed.paddle_yearly_price_id_previous == old_yearly
    assert refreshed.paddle_monthly_price_id not in {None, old_monthly}
    assert refreshed.monthly_price_usd == Decimal("12.00")
    assert refreshed.yearly_price_usd == Decimal("120.00")
    # reprice keys carry the cents amount so they don't dedupe against the initial sync.
    assert all(call[3] is not None for call in fake.prices)
