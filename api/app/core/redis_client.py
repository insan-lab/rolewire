"""Redis client factory with a process-local fallback for dev/test runs."""

from __future__ import annotations

from typing import Any

from redis.asyncio import Redis

from app.core.config import get_settings

_client: Redis | None = None


def get_redis() -> Redis:
    global _client
    if _client is None:
        _client = Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
    _client = None


async def redis_health() -> dict[str, Any]:
    if not get_settings().redis_enabled:
        return {"ok": False, "disabled": True}
    try:
        pong = await get_redis().ping()
        return {"ok": bool(pong)}
    except Exception as exc:  # pragma: no cover - depends on environment
        return {"ok": False, "error": type(exc).__name__}
