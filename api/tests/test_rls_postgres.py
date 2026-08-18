"""Row-Level Security policies, verified against a real Postgres (§3).

The rest of the suite runs on SQLite, where RLS statements are no-ops, so this module is the only
place the actual policies are exercised. It is skipped unless a Postgres URL is provided:

    ROLEWIRE_TEST_PG_URL=postgresql+asyncpg://user:pass@localhost:5432/rolewire_test \
        pytest api/tests/test_rls_postgres.py

The connecting role must be a non-superuser without BYPASSRLS, otherwise Postgres ignores the
policies and these assertions would pass for the wrong reason (asserted below).
"""

from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, ProgrammingError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

PG_URL = os.environ.get("ROLEWIRE_TEST_PG_URL")

pytestmark = pytest.mark.skipif(not PG_URL, reason="ROLEWIRE_TEST_PG_URL is not set")


@pytest.fixture
async def pg_sessionmaker():
    from alembic.config import Config

    from alembic import command

    engine = create_async_engine(str(PG_URL))
    config = Config("api/alembic.ini")
    config.set_main_option("sqlalchemy.url", str(PG_URL))
    os.environ["DATABASE_URL"] = str(PG_URL)

    command.downgrade(config, "base")
    command.upgrade(config, "head")
    try:
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        await engine.dispose()


async def _seed_two_tenants(session) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    alpha, beta = uuid.uuid4(), uuid.uuid4()
    await session.execute(
        text("INSERT INTO tenants (id, name, slug, status) VALUES (:id, 'Alpha', 'alpha', 'active')"),
        {"id": alpha},
    )
    await session.execute(
        text("INSERT INTO tenants (id, name, slug, status) VALUES (:id, 'Beta', 'beta', 'active')"),
        {"id": beta},
    )
    alpha_job = uuid.uuid4()
    await session.execute(text("SELECT set_config('app.current_tenant_id', :t, true)"), {"t": str(alpha)})
    await session.execute(
        text(
            "INSERT INTO jobs (id, tenant_id, title, status, storage_target, opencats_sync,"
            " created_at, updated_at) VALUES (:id, :t, 'Alpha Role', 'published', 'hosted', false,"
            " now(), now())"
        ),
        {"id": alpha_job, "t": alpha},
    )
    await session.commit()
    return alpha, beta, alpha_job


async def test_role_is_subject_to_rls(pg_sessionmaker) -> None:
    async with pg_sessionmaker() as session:
        row = await session.execute(text("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"))
        is_super, bypasses = row.one()
    assert not is_super and not bypasses, (
        "the test role bypasses RLS; these assertions would be meaningless"
    )


async def test_tenant_context_scopes_reads(pg_sessionmaker) -> None:
    async with pg_sessionmaker() as session:
        alpha, beta, _ = await _seed_two_tenants(session)

    async with pg_sessionmaker() as session:
        await session.execute(text("SELECT set_config('app.current_tenant_id', :t, true)"), {"t": str(alpha)})
        assert (await session.scalar(text("SELECT count(*) FROM jobs"))) == 1

        await session.execute(text("SELECT set_config('app.current_tenant_id', :t, true)"), {"t": str(beta)})
        assert (await session.scalar(text("SELECT count(*) FROM jobs"))) == 0


async def test_no_context_means_no_rows(pg_sessionmaker) -> None:
    async with pg_sessionmaker() as session:
        await _seed_two_tenants(session)

    async with pg_sessionmaker() as session:
        assert (await session.scalar(text("SELECT count(*) FROM jobs"))) == 0
        assert (await session.scalar(text("SELECT count(*) FROM applications"))) == 0


async def test_insert_for_another_tenant_is_blocked(pg_sessionmaker) -> None:
    async with pg_sessionmaker() as session:
        alpha, beta, _ = await _seed_two_tenants(session)

    async with pg_sessionmaker() as session:
        await session.execute(text("SELECT set_config('app.current_tenant_id', :t, true)"), {"t": str(beta)})
        with pytest.raises((DBAPIError, ProgrammingError)):
            await session.execute(
                text(
                    "INSERT INTO jobs (id, tenant_id, title, status, storage_target, opencats_sync,"
                    " created_at, updated_at) VALUES (:id, :t, 'Smuggled', 'draft', 'hosted', false,"
                    " now(), now())"
                ),
                {"id": uuid.uuid4(), "t": alpha},
            )
        await session.rollback()


async def test_public_context_exposes_only_published_jobs(pg_sessionmaker) -> None:
    async with pg_sessionmaker() as session:
        alpha, _, _ = await _seed_two_tenants(session)
        await session.execute(text("SELECT set_config('app.current_tenant_id', :t, true)"), {"t": str(alpha)})
        await session.execute(
            text(
                "INSERT INTO jobs (id, tenant_id, title, status, storage_target, opencats_sync,"
                " created_at, updated_at) VALUES (:id, :t, 'Draft Role', 'draft', 'hosted', false,"
                " now(), now())"
            ),
            {"id": uuid.uuid4(), "t": alpha},
        )
        await session.commit()

    async with pg_sessionmaker() as session:
        await session.execute(text("SELECT set_config('app.public_context', 'on', true)"))
        titles = list(await session.scalars(text("SELECT title FROM jobs")))
    assert titles == ["Alpha Role"]


async def test_platform_context_reads_across_tenants(pg_sessionmaker) -> None:
    async with pg_sessionmaker() as session:
        alpha, beta, _ = await _seed_two_tenants(session)
        await session.execute(text("SELECT set_config('app.current_tenant_id', :t, true)"), {"t": str(beta)})
        await session.execute(
            text(
                "INSERT INTO jobs (id, tenant_id, title, status, storage_target, opencats_sync,"
                " created_at, updated_at) VALUES (:id, :t, 'Beta Role', 'draft', 'hosted', false,"
                " now(), now())"
            ),
            {"id": uuid.uuid4(), "t": beta},
        )
        await session.commit()

    async with pg_sessionmaker() as session:
        await session.execute(text("SELECT set_config('app.platform_context', 'on', true)"))
        titles = set(await session.scalars(text("SELECT title FROM jobs")))
    assert titles == {"Alpha Role", "Beta Role"}


async def test_platform_context_is_select_only(pg_sessionmaker) -> None:
    async with pg_sessionmaker() as session:
        alpha, _, alpha_job = await _seed_two_tenants(session)

    async with pg_sessionmaker() as session:
        await session.execute(text("SELECT set_config('app.platform_context', 'on', true)"))
        result = await session.execute(
            text("UPDATE jobs SET title = 'Smuggled' WHERE id = :id"), {"id": alpha_job}
        )
        assert result.rowcount == 0
        await session.rollback()


async def test_auth_context_is_select_only(pg_sessionmaker) -> None:
    async with pg_sessionmaker() as session:
        alpha, _, _ = await _seed_two_tenants(session)
        await session.execute(text("SELECT set_config('app.current_tenant_id', :t, true)"), {"t": str(alpha)})
        await session.execute(
            text(
                "INSERT INTO users (id, tenant_id, email, email_verified, role,"
                " created_at) VALUES (:id, :t, 'owner@alpha.example', true, 'admin', now())"
            ),
            {"id": uuid.uuid4(), "t": alpha},
        )
        await session.commit()

    async with pg_sessionmaker() as session:
        await session.execute(text("SELECT set_config('app.auth_context', 'on', true)"))
        assert (await session.scalar(text("SELECT count(*) FROM users"))) == 1
        # The lookup policy grants SELECT only: an update under auth context matches no rows.
        result = await session.execute(
            text("UPDATE users SET email_verified = false WHERE email = 'owner@alpha.example'")
        )
        assert result.rowcount == 0
        await session.rollback()
