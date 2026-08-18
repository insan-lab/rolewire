"""Background job enqueueing (arq over Redis).

Callers on the request path use :func:`enqueue`, which never raises: a Redis outage must not turn
a successfully-stored application into a 500 for the applicant. Dropped enqueues are logged and
recoverable by the reconciliation cron, since ``applications.status`` stays ``received``.
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_pool: ArqRedis | None = None


def redis_settings() -> RedisSettings:
    parsed = urlparse(get_settings().redis_url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password,
        database=int(parsed.path.lstrip("/") or 0),
    )


async def get_pool() -> ArqRedis:
    global _pool
    if _pool is None:
        _pool = await create_pool(redis_settings())
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
    _pool = None


async def enqueue(task: str, *args: Any, **kwargs: Any) -> str | None:
    """Enqueue a worker task. Returns the job id, or None if the queue was unreachable."""
    try:
        pool = await get_pool()
        job = await pool.enqueue_job(task, *args, **kwargs)
    except Exception as exc:
        logger.warning("failed to enqueue %s: %s", task, exc)
        return None
    return job.job_id if job else None
