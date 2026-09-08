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


async def test_update_company_status(client: AsyncClient) -> None:
    tenant_headers = await auth_headers(client, email="owner@acme.io", company="Acme Corp")
    headers = await _platform_headers(client)

    companies = await client.get("/v1/admin/platform/companies", headers=headers)
    assert companies.status_code == 200
    company = companies.json()["items"][0]
    company_id = company["id"]
    assert company["status"] == "active"

    # Suspend company
    patch_res = await client.patch(
        f"/v1/admin/platform/companies/{company_id}",
        headers=headers,
        json={"status": "suspended"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "suspended"

    # Restore company
    patch_res2 = await client.patch(
        f"/v1/admin/platform/companies/{company_id}",
        headers=headers,
        json={"status": "active"},
    )
    assert patch_res2.status_code == 200
    assert patch_res2.json()["status"] == "active"


async def test_update_job_status(client: AsyncClient) -> None:
    tenant_headers = await auth_headers(client, email="recruiter@globex.io", company="Globex")
    create_job = await client.post(
        "/v1/admin/jobs",
        headers=tenant_headers,
        json={"title": "Senior Engineer", "status": "draft"},
    )
    assert create_job.status_code == 201
    job_id = create_job.json()["id"]

    headers = await _platform_headers(client)

    # Change job status to published
    patch_res = await client.patch(
        f"/v1/admin/platform/jobs/{job_id}",
        headers=headers,
        json={"status": "published"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "published"

    # Change job status to closed
    patch_res2 = await client.patch(
        f"/v1/admin/platform/jobs/{job_id}",
        headers=headers,
        json={"status": "closed"},
    )
    assert patch_res2.status_code == 200
    assert patch_res2.json()["status"] == "closed"


async def test_update_plan_paddle_ids(client: AsyncClient, seed_plan) -> None:
    headers = await _platform_headers(client)

    plans_res = await client.get("/v1/admin/platform/plans", headers=headers)
    assert plans_res.status_code == 200
    plan = plans_res.json()[0]
    assert plan["paddle_monthly_price_id"] == "pri_monthly_basic"

    patch_res = await client.patch(
        f"/v1/admin/platform/plans/{plan['id']}",
        headers=headers,
        json={"paddle_monthly_price_id": "pri_new_m", "paddle_yearly_price_id": "pri_new_y"},
    )
    assert patch_res.status_code == 200, patch_res.text
    assert patch_res.json()["paddle_monthly_price_id"] == "pri_new_m"
    assert patch_res.json()["paddle_yearly_price_id"] == "pri_new_y"

    # Blank clears the id.
    clear_res = await client.patch(
        f"/v1/admin/platform/plans/{plan['id']}",
        headers=headers,
        json={"paddle_monthly_price_id": "  ", "paddle_yearly_price_id": "pri_new_y"},
    )
    assert clear_res.status_code == 200
    assert clear_res.json()["paddle_monthly_price_id"] is None


async def test_update_user_role_and_verification(client: AsyncClient) -> None:
    tenant_headers = await auth_headers(client, email="member@initech.io", company="Initech")
    headers = await _platform_headers(client)

    users_res = await client.get("/v1/admin/platform/users", headers=headers)
    assert users_res.status_code == 200
    user = users_res.json()["items"][0]
    user_id = user["id"]

    # Update role to member and verified to True
    patch_res = await client.patch(
        f"/v1/admin/platform/users/{user_id}",
        headers=headers,
        json={"role": "member", "email_verified": True},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["role"] == "member"
    assert patch_res.json()["email_verified"] is True
