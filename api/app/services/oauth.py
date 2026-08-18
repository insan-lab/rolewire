"""OAuth2/OIDC social login (§5.3).

One generic Authorization-Code-plus-PKCE handler covers all four providers; per-provider quirks
are isolated in :data:`PROVIDERS` and :func:`fetch_profile`:

* Google/LinkedIn expose OIDC userinfo with a verified email.
* GitHub is OAuth2-only — the primary email needs a second call to ``/user/emails``.
* Facebook may return no email at all even after granting login, so the caller must handle
  ``email=None`` by prompting instead of failing.

``state`` and the PKCE ``code_verifier`` are mandatory and held in Redis with a 5 minute TTL.
Redirect URIs are derived from configured settings, never from request input.
"""

from __future__ import annotations

import json
import secrets
from dataclasses import dataclass, field

import httpx
from authlib.integrations.httpx_client import AsyncOAuth2Client

from app.core.config import get_settings
from app.core.redis_client import get_redis

STATE_TTL = 300
STATE_PREFIX = "oauth:state"


class OAuthError(Exception):
    pass


class UnknownProvider(OAuthError):
    pass


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    authorize_url: str
    token_url: str
    scope: str
    userinfo_url: str | None = None
    email_always_verified: bool = True
    extra_authorize_params: dict[str, str] = field(default_factory=dict)


PROVIDERS: dict[str, ProviderConfig] = {
    "google": ProviderConfig(
        name="google",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        scope="openid email profile",
        userinfo_url="https://openidconnect.googleapis.com/v1/userinfo",
        extra_authorize_params={"access_type": "online", "prompt": "select_account"},
    ),
    "github": ProviderConfig(
        name="github",
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        scope="read:user user:email",
        userinfo_url="https://api.github.com/user",
    ),
    "facebook": ProviderConfig(
        name="facebook",
        authorize_url="https://www.facebook.com/v21.0/dialog/oauth",
        token_url="https://graph.facebook.com/v21.0/oauth/access_token",
        scope="email public_profile",
        userinfo_url="https://graph.facebook.com/me?fields=id,name,email,picture",
        email_always_verified=False,
    ),
    # LinkedIn's OIDC product ("Sign In with LinkedIn using OpenID Connect"). Endpoints have
    # shifted before — re-confirm scopes against LinkedIn's current docs at deploy time (§14.5).
    "linkedin": ProviderConfig(
        name="linkedin",
        authorize_url="https://www.linkedin.com/oauth/v2/authorization",
        token_url="https://www.linkedin.com/oauth/v2/accessToken",
        scope="openid profile email",
        userinfo_url="https://api.linkedin.com/v2/userinfo",
    ),
}


@dataclass(frozen=True)
class Profile:
    provider: str
    provider_user_id: str
    email: str | None
    email_verified: bool
    name: str | None
    avatar_url: str | None
    raw: dict[str, object]


def get_provider(name: str) -> ProviderConfig:
    try:
        return PROVIDERS[name]
    except KeyError as exc:
        raise UnknownProvider(f"unsupported oauth provider '{name}'") from exc


def _credentials(provider: str) -> tuple[str, str]:
    settings = get_settings()
    enabled = getattr(settings, f"oauth_{provider}_enable", True)
    if not enabled:
        raise OAuthError(f"{provider} oauth is disabled")
    client_id = getattr(settings, f"oauth_{provider}_client_id", "")
    client_secret = getattr(settings, f"oauth_{provider}_client_secret", "")
    if not client_id or not client_secret:
        raise OAuthError(f"{provider} oauth client credentials are not configured")
    return client_id, client_secret


def redirect_uri(provider: str) -> str:
    base = get_settings().oauth_redirect_base_url.rstrip("/")
    return f"{base}/v1/admin/auth/oauth/{provider}/callback"


def _pkce_pair() -> str:
    """Return a PKCE ``code_verifier``; authlib derives the S256 challenge from it."""
    return secrets.token_urlsafe(64)


async def start_flow(provider_name: str, *, link_user_id: str | None = None) -> tuple[str, str]:
    """Return ``(authorization_url, state)`` and stash the PKCE verifier in Redis."""
    provider = get_provider(provider_name)
    client_id, client_secret = _credentials(provider_name)
    verifier = _pkce_pair()
    state = secrets.token_urlsafe(32)

    client = AsyncOAuth2Client(
        client_id=client_id,
        client_secret=client_secret,
        scope=provider.scope,
        redirect_uri=redirect_uri(provider_name),
        code_challenge_method="S256",
    )
    url, _ = client.create_authorization_url(
        provider.authorize_url,
        state=state,
        code_verifier=verifier,
        **provider.extra_authorize_params,
    )
    await get_redis().setex(
        f"{STATE_PREFIX}:{state}",
        STATE_TTL,
        json.dumps(
            {"provider": provider_name, "code_verifier": verifier, "link_user_id": link_user_id}
        ),
    )
    return url, state


async def consume_state(provider_name: str, state: str) -> dict[str, str | None]:
    """Single-use retrieval of the stored PKCE verifier for ``state``."""
    raw = await get_redis().getdel(f"{STATE_PREFIX}:{state}")
    if raw is None:
        raise OAuthError("oauth state is unknown or expired")
    data = json.loads(raw)
    if data.get("provider") != provider_name:
        raise OAuthError("oauth state does not match this provider")
    return data


async def exchange_code(provider_name: str, *, code: str, code_verifier: str) -> dict[str, object]:
    provider = get_provider(provider_name)
    client_id, client_secret = _credentials(provider_name)
    async with AsyncOAuth2Client(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri(provider_name),
    ) as client:
        token = await client.fetch_token(
            provider.token_url,
            code=code,
            code_verifier=code_verifier,
            headers={"Accept": "application/json"},
        )
    return dict(token)


async def fetch_profile(provider_name: str, token: dict[str, object]) -> Profile:
    provider = get_provider(provider_name)
    access_token = str(token.get("access_token") or "")
    if not access_token:
        raise OAuthError("provider did not return an access token")
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(str(provider.userinfo_url), headers=headers)
        if response.status_code != 200:
            raise OAuthError(f"{provider_name} userinfo failed ({response.status_code})")
        data: dict[str, object] = response.json()

        if provider_name == "github":
            emails_response = await client.get(
                "https://api.github.com/user/emails", headers=headers
            )
            primary_email, verified = None, False
            if emails_response.status_code == 200:
                for entry in emails_response.json():
                    if entry.get("primary"):
                        primary_email = entry.get("email")
                        verified = bool(entry.get("verified"))
                        break
            return Profile(
                provider=provider_name,
                provider_user_id=str(data["id"]),
                email=primary_email or (data.get("email") if isinstance(data.get("email"), str) else None),
                email_verified=verified,
                name=data.get("name") if isinstance(data.get("name"), str) else None,
                avatar_url=data.get("avatar_url") if isinstance(data.get("avatar_url"), str) else None,
                raw=data,
            )

    if provider_name == "facebook":
        picture = data.get("picture")
        avatar = None
        if isinstance(picture, dict):
            picture_data = picture.get("data")
            if isinstance(picture_data, dict):
                avatar = picture_data.get("url")
        return Profile(
            provider=provider_name,
            provider_user_id=str(data["id"]),
            email=data.get("email") if isinstance(data.get("email"), str) else None,
            # Facebook does not guarantee a verified email — never auto-link on this one.
            email_verified=False,
            name=data.get("name") if isinstance(data.get("name"), str) else None,
            avatar_url=avatar if isinstance(avatar, str) else None,
            raw=data,
        )

    # Google + LinkedIn: standard OIDC userinfo claims.
    return Profile(
        provider=provider_name,
        provider_user_id=str(data.get("sub") or data.get("id")),
        email=data.get("email") if isinstance(data.get("email"), str) else None,
        email_verified=bool(data.get("email_verified", provider.email_always_verified)),
        name=data.get("name") if isinstance(data.get("name"), str) else None,
        avatar_url=data.get("picture") if isinstance(data.get("picture"), str) else None,
        raw=data,
    )
