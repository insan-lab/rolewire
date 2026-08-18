"""Usage metering (§3, §6).

Hot-path counters live in Redis so an application submission never writes a metering row
synchronously to Postgres; a worker cron flushes the counters into ``usage_events`` for billing
reconciliation.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis_client import get_redis
from app.models import UsageEvent

COUNTER_PREFIX = "usage"
EVENT_TYPES = ("storage_mb", "opencats_active", "application_received")


def _bucket(now: datetime | None = None) -> str:
    return (now or datetime.now(UTC)).strftime("%Y%m%d%H")


def counter_key(tenant_id: UUID | str, event_type: str, now: datetime | None = None) -> str:
    return f"{COUNTER_PREFIX}:{_bucket(now)}:{tenant_id}:{event_type}"


async def record(tenant_id: UUID | str, event_type: str, quantity: float = 1) -> None:
    """Increment the rolling Redis counter; never raises on cache failure."""
    if event_type not in EVENT_TYPES:
        raise ValueError(f"unknown usage event_type '{event_type}'")
    if not get_settings().redis_enabled:
        return
    try:
        redis = get_redis()
        key = counter_key(tenant_id, event_type)
        pipe = redis.pipeline()
        pipe.incrbyfloat(key, quantity)
        pipe.expire(key, 3 * 24 * 3600)
        await pipe.execute()
    except Exception:
        # Metering is best-effort on the hot path; the durable record is the applications row.
        return


async def flush_counters(session: AsyncSession) -> int:
    """Move completed Redis counter buckets into ``usage_events``. Returns rows written."""
    redis = get_redis()
    current = _bucket()
    written = 0
    async for key in redis.scan_iter(match=f"{COUNTER_PREFIX}:*"):
        _, bucket, tenant_id, event_type = key.split(":")
        if bucket == current:
            continue  # still accumulating
        raw = await redis.getdel(key)
        if raw is None:
            continue
        occurred_at = datetime.strptime(bucket, "%Y%m%d%H").replace(tzinfo=UTC)
        session.add(
            UsageEvent(
                tenant_id=UUID(tenant_id),
                event_type=event_type,
                quantity=Decimal(str(raw)),
                occurred_at=occurred_at,
            )
        )
        written += 1
    await session.flush()
    return written


async def totals_for_tenant(session: AsyncSession, tenant_id: UUID) -> dict[str, Decimal]:
    rows = await session.execute(
        select(UsageEvent.event_type, UsageEvent.quantity).where(UsageEvent.tenant_id == tenant_id)
    )
    totals: dict[str, Decimal] = {}
    for event_type, quantity in rows:
        totals[event_type] = totals.get(event_type, Decimal(0)) + Decimal(quantity)
    return totals
