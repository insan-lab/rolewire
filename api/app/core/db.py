"""Async SQLAlchemy engine/session plumbing plus the Postgres RLS session context.

Tenant isolation (§3) is enforced by Postgres Row-Level Security. Every request sets
``app.current_tenant_id`` with ``set_config(..., is_local => true)`` so the setting is scoped to
the surrounding transaction and cannot leak into another pooled connection's work.

Public (unauthenticated) endpoints never receive a tenant id from the caller. They set
``app.public_context`` instead, which only unlocks the narrow "published job" read policy, then
resolve the owning tenant server-side and set the normal tenant context from the job record.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _engine_kwargs() -> dict[str, object]:
    settings = get_settings()
    kwargs: dict[str, object] = {"echo": settings.db_echo, "future": True}
    if settings.is_postgres:
        kwargs["pool_size"] = settings.db_pool_size
        kwargs["max_overflow"] = settings.db_max_overflow
        kwargs["pool_pre_ping"] = True
    return kwargs


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(get_settings().database_url, **_engine_kwargs())
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = async_sessionmaker(
            get_engine(), expire_on_commit=False, autoflush=False
        )
    return _sessionmaker


async def dispose_engine() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _sessionmaker = None


def _rls_enabled() -> bool:
    """RLS statements only exist on Postgres; sqlite is used for unit tests."""
    return get_settings().is_postgres


async def set_tenant_context(session: AsyncSession, tenant_id: UUID | str) -> None:
    """Bind the current transaction to a single tenant for RLS purposes."""
    if not _rls_enabled():
        return
    await session.execute(
        text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
        {"tenant_id": str(tenant_id)},
    )


async def clear_tenant_context(session: AsyncSession) -> None:
    if not _rls_enabled():
        return
    await session.execute(text("SELECT set_config('app.current_tenant_id', '', true)"))


async def set_public_context(session: AsyncSession) -> None:
    """Unlock the read-only "published jobs" policy for unauthenticated lookups."""
    if not _rls_enabled():
        return
    await session.execute(text("SELECT set_config('app.public_context', 'on', true)"))


async def set_auth_context(session: AsyncSession) -> None:
    """Unlock the pre-authentication identity lookup policies on ``users``/``oauth_accounts``.

    Login and OAuth callbacks must find a user *before* a tenant is known. The policy this flag
    unlocks is SELECT-only, so a leaked auth context still cannot mutate another tenant's rows.
    """
    if not _rls_enabled():
        return
    await session.execute(text("SELECT set_config('app.auth_context', 'on', true)"))


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one session (and one transaction) per request."""
    async with get_sessionmaker()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def tenant_session(tenant_id: UUID | str) -> AsyncIterator[AsyncSession]:
    """Standalone tenant-scoped session for background workers and scripts."""
    async with get_sessionmaker()() as session:
        try:
            await set_tenant_context(session, tenant_id)
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
