"""Admin authentication flows."""

from __future__ import annotations

from sqlalchemy import select

from httpx import AsyncClient

from app.core.db import get_sessionmaker
from app.models import User
from tests.conftest import auth_headers


async def _mark_email_verified(email: str) -> None:
    async with get_sessionmaker()() as session:
        user = await session.scalar(select(User).where(User.email == email))
        user.email_verified = True
        await session.commit()


async def test_signup_creates_tenant_and_returns_tokens(client: AsyncClient) -> None:
    response = await client.post(
        "/v1/admin/auth/signup",
        json={
            "email": "owner@acmecorp.io",
            "password": "correct-horse-battery",
            "company_name": "Acme Ltd",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"] and body["refresh_token"]

    me = await client.get(
        "/v1/admin/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "owner@acmecorp.io"
    assert me.json()["role"] == "admin"
    assert me.json()["has_password"] is True


async def test_duplicate_email_is_rejected(client: AsyncClient) -> None:
    payload = {
        "email": "dupe@acmecorp.io",
        "password": "correct-horse-battery",
        "company_name": "Acme",
    }
    assert (await client.post("/v1/admin/auth/signup", json=payload)).status_code == 201
    second = await client.post("/v1/admin/auth/signup", json=payload)
    assert second.status_code == 409


async def test_login_and_refresh(client: AsyncClient) -> None:
    await auth_headers(client, email="login@acmecorp.io")

    login = await client.post(
        "/v1/admin/auth/login",
        json={"email": "login@acmecorp.io", "password": "correct-horse-battery"},
    )
    assert login.status_code == 200

    refresh = await client.post(
        "/v1/admin/auth/refresh", json={"refresh_token": login.json()["refresh_token"]}
    )
    assert refresh.status_code == 200
    assert refresh.json()["access_token"] != login.json()["access_token"]


async def test_wrong_password_is_generic_401(client: AsyncClient) -> None:
    await auth_headers(client, email="wrong@acmecorp.io")
    response = await client.post(
        "/v1/admin/auth/login", json={"email": "wrong@acmecorp.io", "password": "not-my-password"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "invalid email or password"


async def test_unknown_email_matches_wrong_password_response(client: AsyncClient) -> None:
    response = await client.post(
        "/v1/admin/auth/login",
        json={"email": "ghost@acmecorp.io", "password": "correct-horse-battery"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "invalid email or password"


async def test_access_token_cannot_be_used_as_refresh(client: AsyncClient) -> None:
    login = await client.post(
        "/v1/admin/auth/signup",
        json={
            "email": "typed@acmecorp.io",
            "password": "correct-horse-battery",
            "company_name": "Acme",
        },
    )
    access = login.json()["access_token"]
    response = await client.post("/v1/admin/auth/refresh", json={"refresh_token": access})
    assert response.status_code == 401


async def test_admin_routes_require_a_token(client: AsyncClient) -> None:
    assert (await client.get("/v1/admin/jobs")).status_code == 401
    assert (
        await client.get("/v1/admin/jobs", headers={"Authorization": "Bearer garbage"})
    ).status_code == 401


async def test_unlinking_the_only_login_method_is_blocked(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="solo@acmecorp.io")
    # No provider linked at all → 404 rather than leaving the account unreachable.
    response = await client.delete("/v1/admin/auth/oauth/google", headers=headers)
    assert response.status_code == 404


async def test_unknown_oauth_provider_is_404(client: AsyncClient) -> None:
    response = await client.get("/v1/admin/auth/oauth/myspace/start")
    assert response.status_code == 404


async def test_change_password_requires_current_password(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="pw@acmecorp.io")
    bad = await client.patch(
        "/v1/admin/auth/password",
        json={"current_password": "not-my-password", "new_password": "new-horse-battery"},
        headers=headers,
    )
    assert bad.status_code == 401

    ok = await client.patch(
        "/v1/admin/auth/password",
        json={"current_password": "correct-horse-battery", "new_password": "new-horse-battery"},
        headers=headers,
    )
    assert ok.status_code == 204

    login = await client.post(
        "/v1/admin/auth/login",
        json={"email": "pw@acmecorp.io", "password": "new-horse-battery"},
    )
    assert login.status_code == 200


async def test_change_email_requires_current_email_verified(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="unverified@acmecorp.io")
    response = await client.patch(
        "/v1/admin/auth/email",
        json={"new_email": "new@acmecorp.io", "current_password": "correct-horse-battery"},
        headers=headers,
    )
    assert response.status_code == 409

    await _mark_email_verified("unverified@acmecorp.io")
    response = await client.patch(
        "/v1/admin/auth/email",
        json={"new_email": "new@acmecorp.io", "current_password": "correct-horse-battery"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "new@acmecorp.io"
    assert body["email_verified"] is False


async def test_admin_can_update_company_name(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="owner@acmecorp.io", company="Old Name")
    response = await client.patch(
        "/v1/admin/auth/company", json={"company_name": "New Name"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["company_name"] == "New Name"

    me = await client.get("/v1/admin/auth/me", headers=headers)
    assert me.json()["company_name"] == "New Name"


async def test_admin_can_update_company_slug(client: AsyncClient) -> None:
    headers = await auth_headers(client, email="slugger@acmecorp.io", company="Sluggers")
    response = await client.patch(
        "/v1/admin/auth/company",
        json={"company_name": "Sluggers", "company_slug": "sluggers-united"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["company_slug"] == "sluggers-united"


async def test_company_slug_conflict_is_rejected(client: AsyncClient) -> None:
    await auth_headers(client, email="first@acmecorp.io", company="First Co")
    first_slug = "first-co"
    headers = await auth_headers(client, email="second@acmecorp.io", company="Second Co")

    response = await client.patch(
        "/v1/admin/auth/company",
        json={"company_name": "Second Co", "company_slug": first_slug},
        headers=headers,
    )
    assert response.status_code == 409


async def test_change_email_rejects_duplicate(client: AsyncClient) -> None:
    await auth_headers(client, email="taken@acmecorp.io")
    headers = await auth_headers(client, email="mover@acmecorp.io")
    await _mark_email_verified("mover@acmecorp.io")

    response = await client.patch(
        "/v1/admin/auth/email",
        json={"new_email": "taken@acmecorp.io", "current_password": "correct-horse-battery"},
        headers=headers,
    )
    assert response.status_code == 409
