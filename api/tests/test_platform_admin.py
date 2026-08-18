"""Platform superadmin router: auth, stats, and cross-tenant lists.

Runs on SQLite like the rest of the suite, so it exercises routing/auth/serialization; the
`platform_read` RLS policy itself is only real on Postgres (test_rls_postgres.py).
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from app.core.db import get_sessionmaker
from app.core.security import hash_password
from app.models import PlatformAdmin
from tests.conftest import auth_headers

PLATFORM_EMAIL = "root@rolewire.io"
PLATFORM_PASSWORD = "correct-horse-battery-staple"


async def _seed_platform_admin() -> None:
    async with get_sessionmaker()() as session:
        session.add(
            PlatformAdmin(
                id=uuid.uuid4(),
                email=PLATFORM_EMAIL,
                password_hash=hash_password(PLATFORM_PASSWORD),
            )
        )
        await session.commit()


async def _platform_headers(client: AsyncClient) -> dict[str, str]:
    await _seed_platform_admin()
    response = await client.post(
        "/v1/admin/platform/auth/login",
        json={"email": PLATFORM_EMAIL, "password": PLATFORM_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def test_login_rejects_wrong_password(client: AsyncClient) -> None:
    await _seed_platform_admin()
    response = await client.post(
        "/v1/admin/platform/auth/login",
        json={"email": PLATFORM_EMAIL, "password": "wrong-password-entirely"},
    )
    assert response.status_code == 401


async def test_tenant_token_cannot_reach_platform_routes(client: AsyncClient) -> None:
    tenant_headers = await auth_headers(client, email="owner@acmecorp.io")
    response = await client.get("/v1/admin/platform/stats", headers=tenant_headers)
    assert response.status_code == 401


async def test_stats_and_lists_span_every_tenant(client: AsyncClient) -> None:
    await auth_headers(client, email="owner@acme.io", company="Acme")
    await auth_headers(client, email="owner@globex.io", company="Globex")
    headers = await _platform_headers(client)

    stats = await client.get("/v1/admin/platform/stats", headers=headers)
    assert stats.status_code == 200
    body = stats.json()
    assert body["tenants_total"] == 2
    assert body["users_total"] == 2

    users = await client.get("/v1/admin/platform/users", headers=headers)
    assert users.status_code == 200
    assert {u["email"] for u in users.json()["items"]} == {"owner@acme.io", "owner@globex.io"}

    companies = await client.get("/v1/admin/platform/companies", headers=headers)
    assert companies.status_code == 200
    assert {c["name"] for c in companies.json()["items"]} == {"Acme", "Globex"}


async def test_refresh_issues_a_new_platform_pair(client: AsyncClient) -> None:
    headers = await _platform_headers(client)
    me_before = await client.get("/v1/admin/platform/auth/me", headers=headers)
    assert me_before.status_code == 200

    login = await client.post(
        "/v1/admin/platform/auth/login",
        json={"email": PLATFORM_EMAIL, "password": PLATFORM_PASSWORD},
    )
    refresh = await client.post(
        "/v1/admin/platform/auth/refresh",
        json={"refresh_token": login.json()["refresh_token"]},
    )
    assert refresh.status_code == 200
    assert refresh.json()["access_token"]
