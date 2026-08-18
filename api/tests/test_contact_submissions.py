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


async def test_public_contact_submission_creates_db_record(client: AsyncClient) -> None:
    response = await client.post(
        "/v1/public/contact",
        json={
            "name": "Jane Doe",
            "email": "jane@example.com",
            "message": "Hello, I have a question about pricing.",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["id"]
    assert data["name"] == "Jane Doe"
    assert data["email"] == "jane@example.com"
    assert data["message"] == "Hello, I have a question about pricing."
    assert data["status"] == "pending"


async def test_platform_admin_can_list_and_update_contact_submissions(
    client: AsyncClient,
) -> None:
    # 1. Create a submission
    create_res = await client.post(
        "/v1/public/contact",
        json={
            "name": "John Smith",
            "email": "john@acme.com",
            "message": "Interested in enterprise plan.",
        },
    )
    assert create_res.status_code == 201
    sub_id = create_res.json()["id"]

    headers = await _platform_headers(client)

    # 2. List submissions
    list_res = await client.get("/v1/admin/platform/contact-submissions", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert any(item["id"] == sub_id for item in items)

    # 3. Update status to in_progress then resolved
    patch_res = await client.patch(
        f"/v1/admin/platform/contact-submissions/{sub_id}",
        headers=headers,
        json={"status": "in_progress"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "in_progress"

    patch_res2 = await client.patch(
        f"/v1/admin/platform/contact-submissions/{sub_id}",
        headers=headers,
        json={"status": "resolved"},
    )
    assert patch_res2.status_code == 200
    assert patch_res2.json()["status"] == "resolved"


async def test_tenant_user_cannot_access_contact_submissions(client: AsyncClient) -> None:
    tenant_headers = await auth_headers(client, email="user@acme.com")
    response = await client.get(
        "/v1/admin/platform/contact-submissions", headers=tenant_headers
    )
    assert response.status_code == 401
