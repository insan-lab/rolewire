"""Shared test fixtures.

Tests run against SQLite so the suite needs no external services: the RLS statements are
no-ops off Postgres (see ``app.core.db``), and the Redis-backed rate limiter/usage counters fall
back to their in-process paths because the configured Redis port is closed. Postgres-only
behaviour (the RLS policies themselves) is covered by ``test_rls_postgres.py``, which skips
unless ``ROLEWIRE_TEST_PG_URL`` is set.
"""

from __future__ import annotations

import os
import tempfile
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

_TMP_DB = Path(tempfile.gettempdir()) / f"rolewire-test-{uuid.uuid4().hex}.sqlite"

os.environ.update(
    {
        "ENVIRONMENT": "test",
        "DATABASE_URL": f"sqlite+aiosqlite:///{_TMP_DB.as_posix()}",
        # No Redis in the test environment: rate limiting uses the in-process fallback and
        # queue/usage writes are skipped.
        "REDIS_URL": "redis://127.0.0.1:1/0",
        "REDIS_ENABLED": "false",
        "JWT_SECRET": "test-secret-not-for-production-0123456789abcdef",
        "ENCRYPTION_KEY": "GmM1RmH-3xYrqmvUB6a0OaTNvXcJn0fJ5nWJHDGKQ9c=",
        "IP_HASH_SALT": "test-salt",
        "PUBLIC_APPLY_RATE_LIMIT": "50",
        "PUBLIC_READ_RATE_LIMIT": "10000",
        "PADDLE_WEBHOOK_SECRET": "paddle-test-secret",
        "UDDOKTAPAY_API_KEY": "uddoktapay-test-key",
        "BREVO_WEBHOOK_SECRET": "brevo-test-secret",
        "EXPOSE_DOCS": "true",
    }
)

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.core import rate_limit  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.db import Base, dispose_engine, get_engine, get_sessionmaker  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import Plan  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _cleanup_db_file() -> AsyncIterator[None]:
    yield
    _TMP_DB.unlink(missing_ok=True)


@pytest.fixture(autouse=True)
async def _fresh_schema() -> AsyncIterator[None]:
    engine = get_engine()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    rate_limit.reset_local_state()
    yield
    await dispose_engine()


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client


@pytest.fixture
async def seed_plan() -> Plan:
    """A basic plan with both Paddle price ids and BDT pricing configured."""
    async with get_sessionmaker()() as session:
        plan = Plan(
            id=uuid.uuid4(),
            name="basic",
            monthly_price_usd=9,
            yearly_price_usd=90,
            monthly_price_bdt=990,
            yearly_price_bdt=9900,
            paddle_monthly_price_id="pri_monthly_basic",
            paddle_yearly_price_id="pri_yearly_basic",
            features={"email_sending": False, "opencats_included": False},
        )
        session.add(plan)
        await session.commit()
        return plan


@pytest.fixture
def settings():
    return get_settings()


async def auth_headers(client: AsyncClient, *, email: str, company: str = "Acme Ltd") -> dict[str, str]:
    response = await client.post(
        "/v1/admin/auth/signup",
        json={"email": email, "password": "correct-horse-battery", "company_name": company},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


PUBLISHED_JOB = {
    "title": "Backend Engineer",
    "description": "Build the thing.",
    "location": "Remote",
    "employment_type": "full_time",
    "status": "published",
    "questions": [
        {"label": "Full Name", "field_key": "full_name", "question_type": "text", "required": True},
        {"label": "Email", "field_key": "email", "question_type": "email", "required": True},
        {
            "label": "Years of Experience",
            "field_key": "years_experience",
            "question_type": "number",
            "required": True,
        },
        {
            "label": "Notice Period",
            "field_key": "notice_period",
            "question_type": "select",
            "options": ["Immediate", "2 weeks", "1 month"],
            "required": True,
        },
        {"label": "Resume", "field_key": "resume", "question_type": "file", "required": False},
    ],
}
