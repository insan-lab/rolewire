"""Fixed-window rate limiting for the intentionally unauthenticated public API (§5.1).

Backed by Redis so limits hold across API replicas. If Redis is unavailable the limiter falls
back to an in-process window: correctness degrades to per-worker, but the public endpoints keep
serving rather than hard-failing on a cache outage.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from app.core.redis_client import get_redis


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    remaining: int
    retry_after: int


_local_windows: dict[str, tuple[int, float]] = {}


def _local_hit(key: str, limit: int, window_seconds: int) -> RateLimitResult:
    now = time.monotonic()
    count, expires_at = _local_windows.get(key, (0, 0.0))
    if expires_at <= now:
        count, expires_at = 0, now + window_seconds
    count += 1
    _local_windows[key] = (count, expires_at)
    retry_after = max(int(expires_at - now), 1)
    if count > limit:
        return RateLimitResult(False, 0, retry_after)
    return RateLimitResult(True, max(limit - count, 0), retry_after)


async def hit(key: str, *, limit: int, window_seconds: int) -> RateLimitResult:
    """Register one request against ``key`` and report whether it is allowed."""
    namespaced = f"rl:{key}"
    try:
        redis = get_redis()
        pipe = redis.pipeline()
        pipe.incr(namespaced)
        pipe.ttl(namespaced)
        count, ttl = await pipe.execute()
        if ttl is None or ttl < 0:
            await redis.expire(namespaced, window_seconds)
            ttl = window_seconds
    except Exception:
        return _local_hit(namespaced, limit, window_seconds)

    retry_after = max(int(ttl), 1)
    if int(count) > limit:
        return RateLimitResult(False, 0, retry_after)
    return RateLimitResult(True, max(limit - int(count), 0), retry_after)


def reset_local_state() -> None:
    """Test helper: drop the in-process fallback windows."""
    _local_windows.clear()
