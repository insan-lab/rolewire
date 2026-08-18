"""Social login: profile normalization and account resolution (§5.3)."""

from __future__ import annotations

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.core.db import get_sessionmaker
from app.models import OAuthAccount, Tenant, User
from app.routers import admin_oauth
from app.services import oauth
from tests.conftest import auth_headers


def _profile(**overrides) -> oauth.Profile:
    defaults = {
        "provider": "google",
        "provider_user_id": "google-sub-1",
        "email": "founder@newco.io",
        "email_verified": True,
        "name": "New Co",
        "avatar_url": "https://cdn.example/a.png",
        "raw": {"sub": "google-sub-1"},
    }
    return oauth.Profile(**{**defaults, **overrides})


@pytest.fixture
def stub_oauth(monkeypatch: pytest.MonkeyPatch):
    """Replace the network-facing parts of the flow, keeping the resolution logic under test."""

    def _install(profile: oauth.Profile, *, link_user_id: str | None = None) -> None:
        async def consume_state(provider: str, state: str) -> dict[str, str | None]:
            return {"provider": provider, "code_verifier": "verifier", "link_user_id": link_user_id}

        async def exchange_code(provider: str, *, code: str, code_verifier: str) -> dict[str, object]:
            return {"access_token": "provider-token"}

        async def fetch_profile(provider: str, token: dict[str, object]) -> oauth.Profile:
            return profile

        monkeypatch.setattr(admin_oauth.oauth, "consume_state", consume_state)
        monkeypatch.setattr(admin_oauth.oauth, "exchange_code", exchange_code)
        monkeypatch.setattr(admin_oauth.oauth, "fetch_profile", fetch_profile)

    return _install


async def _callback(client: AsyncClient, provider: str = "google") -> httpx.Response:
    return await client.get(
        f"/v1/admin/auth/oauth/{provider}/callback", params={"code": "auth-code", "state": "state"}
    )


async def test_first_social_login_provisions_a_tenant(client: AsyncClient, stub_oauth) -> None:
    stub_oauth(_profile())
    response = await _callback(client)
    assert response.status_code == 200
    tokens = response.json()

    me = await client.get(
        "/v1/admin/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "founder@newco.io"
    assert me.json()["has_password"] is False
    assert me.json()["oauth_providers"] == ["google"]
    assert me.json()["email_verified"] is True


async def test_returning_social_login_reuses_the_same_account(
    client: AsyncClient, stub_oauth
) -> None:
    stub_oauth(_profile())
    first = await _callback(client)
    second = await _callback(client)
    assert first.status_code == second.status_code == 200

    async with get_sessionmaker()() as session:
        tenants = await session.scalar(select(func.count()).select_from(Tenant))
        users = await session.scalar(select(func.count()).select_from(User))
        accounts = await session.scalar(select(func.count()).select_from(OAuthAccount))
    assert (tenants, users, accounts) == (1, 1, 1)


async def test_verified_provider_email_links_to_an_existing_account(
    client: AsyncClient, stub_oauth
) -> None:
    await auth_headers(client, email="owner@acmecorp.io")
    stub_oauth(_profile(email="owner@acmecorp.io", provider_user_id="google-sub-2"))

    response = await _callback(client)
    assert response.status_code == 200

    async with get_sessionmaker()() as session:
        users = await session.scalar(select(func.count()).select_from(User))
        account = await session.scalar(select(OAuthAccount))
    # Linked, not duplicated.
    assert users == 1
    assert account is not None and account.provider == "google"


async def test_unverified_facebook_email_requires_manual_linking(
    client: AsyncClient, stub_oauth
) -> None:
    await auth_headers(client, email="owner2@acmecorp.io")
    stub_oauth(
        _profile(
            provider="facebook",
            provider_user_id="fb-1",
            email="owner2@acmecorp.io",
            email_verified=False,
        )
    )
    response = await _callback(client, provider="facebook")
    assert response.status_code == 409
    assert "link facebook from account settings" in response.text

    async with get_sessionmaker()() as session:
        accounts = await session.scalar(select(func.count()).select_from(OAuthAccount))
    assert accounts == 0


async def test_provider_without_an_email_cannot_sign_up(client: AsyncClient, stub_oauth) -> None:
    stub_oauth(_profile(provider="facebook", provider_user_id="fb-2", email=None, email_verified=False))
    response = await _callback(client, provider="facebook")
    assert response.status_code == 409
    assert "did not return an email" in response.text


async def test_identity_already_linked_elsewhere_is_rejected_on_link(
    client: AsyncClient, stub_oauth
) -> None:
    # Tenant A signs up with Google.
    stub_oauth(_profile(provider_user_id="google-shared"))
    await _callback(client)

    # Tenant B, logged in with a password, tries to link the same Google identity.
    headers = await auth_headers(client, email="second@betacorp.io", company="Beta LLC")
    user_id = (await client.get("/v1/admin/auth/me", headers=headers)).json()["id"]
    stub_oauth(_profile(provider_user_id="google-shared"), link_user_id=user_id)

    response = await _callback(client)
    assert response.status_code == 409
    assert "already linked to another Rolewire account" in response.text


async def test_linking_then_unlinking_a_provider(client: AsyncClient, stub_oauth) -> None:
    headers = await auth_headers(client, email="linker@acmecorp.io")
    user_id = (await client.get("/v1/admin/auth/me", headers=headers)).json()["id"]
    stub_oauth(_profile(provider_user_id="google-link", email="linker@acmecorp.io"), link_user_id=user_id)

    assert (await _callback(client)).status_code == 200
    me = await client.get("/v1/admin/auth/me", headers=headers)
    assert me.json()["oauth_providers"] == ["google"]

    # The user still has a password, so unlinking is allowed.
    assert (await client.delete("/v1/admin/auth/oauth/google", headers=headers)).status_code == 204
    me = await client.get("/v1/admin/auth/me", headers=headers)
    assert me.json()["oauth_providers"] == []


async def test_oauth_only_user_cannot_unlink_their_last_provider(
    client: AsyncClient, stub_oauth
) -> None:
    stub_oauth(_profile(provider_user_id="google-only"))
    tokens = (await _callback(client)).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    response = await client.delete("/v1/admin/auth/oauth/google", headers=headers)
    assert response.status_code == 409
    assert "only login method" in response.text


async def test_github_profile_uses_the_primary_verified_email(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/user":
            return httpx.Response(200, json={"id": 4242, "name": "Octo Dev", "avatar_url": "https://cdn/x.png"})
        if request.url.path == "/user/emails":
            return httpx.Response(
                200,
                json=[
                    {"email": "secondary@dev.io", "primary": False, "verified": True},
                    {"email": "octo@dev.io", "primary": True, "verified": True},
                ],
            )
        raise AssertionError(f"unexpected call to {request.url}")

    transport = httpx.MockTransport(handler)
    original = httpx.AsyncClient

    def _client(*args, **kwargs):
        kwargs["transport"] = transport
        return original(*args, **kwargs)

    monkeypatch.setattr(oauth.httpx, "AsyncClient", _client)

    profile = await oauth.fetch_profile("github", {"access_token": "gh-token"})
    assert profile.provider_user_id == "4242"
    assert profile.email == "octo@dev.io"
    assert profile.email_verified is True
    assert profile.avatar_url == "https://cdn/x.png"


async def test_facebook_profile_is_never_treated_as_verified(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": "fb-99",
                "name": "Zuck Fan",
                "email": "fan@social.io",
                "picture": {"data": {"url": "https://cdn/fb.png"}},
            },
        )

    original = httpx.AsyncClient

    def _client(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return original(*args, **kwargs)

    monkeypatch.setattr(oauth.httpx, "AsyncClient", _client)

    profile = await oauth.fetch_profile("facebook", {"access_token": "fb-token"})
    assert profile.email == "fan@social.io"
    assert profile.email_verified is False
    assert profile.avatar_url == "https://cdn/fb.png"


def test_redirect_uri_is_built_from_configuration_only() -> None:
    assert oauth.redirect_uri("google").endswith("/v1/admin/auth/oauth/google/callback")
    with pytest.raises(oauth.UnknownProvider):
        oauth.get_provider("myspace")


def test_all_four_providers_are_configured() -> None:
    assert set(oauth.PROVIDERS) == {"google", "github", "facebook", "linkedin"}
    for name, provider in oauth.PROVIDERS.items():
        assert provider.authorize_url.startswith("https://"), name
        assert provider.token_url.startswith("https://"), name
        assert provider.userinfo_url, name
