"""Social login endpoints (§5.3).

The four providers share one Authorization-Code-with-PKCE handler. Account resolution follows the
spec exactly:

1. known ``(provider, provider_user_id)`` → log in as that user;
2. provider email matches an existing user **and** the provider verified that email → link;
3. provider email matches but is unverified (Facebook) → 409, requires explicit confirmation;
4. otherwise → provision a new tenant + owner user.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token
from app.models import User
from app.routers.deps import CurrentPrincipal, DbSession
from app.schemas.auth import OAuthStartOut, TokenPair
from app.services import accounts, oauth

router = APIRouter(prefix="/v1/admin/auth/oauth", tags=["admin:auth"])


def _token_pair(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(
            user_id=str(user.id), tenant_id=str(user.tenant_id), role=user.role
        ),
        refresh_token=create_refresh_token(user_id=str(user.id), tenant_id=str(user.tenant_id)),
        expires_in=get_settings().access_token_ttl_seconds,
    )


def _provider_or_404(provider: str) -> None:
    try:
        oauth.get_provider(provider)
    except oauth.UnknownProvider as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{provider}/start", response_model=OAuthStartOut)
async def start(provider: str, redirect: bool = False) -> OAuthStartOut | RedirectResponse:
    """Begin a sign-in flow. Returns the consent URL, or 302s straight to it."""
    _provider_or_404(provider)
    try:
        url, state = await oauth.start_flow(provider)
    except oauth.OAuthError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    if redirect:
        return RedirectResponse(url, status_code=status.HTTP_302_FOUND)
    return OAuthStartOut(authorization_url=url, state=state)


@router.post("/{provider}/link", response_model=OAuthStartOut)
async def start_link(provider: str, principal: CurrentPrincipal) -> OAuthStartOut:
    """Begin a flow that links ``provider`` to the already-authenticated user."""
    _provider_or_404(provider)
    try:
        url, state = await oauth.start_flow(provider, link_user_id=str(principal.user.id))
    except oauth.OAuthError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return OAuthStartOut(authorization_url=url, state=state)


@router.get("/{provider}/callback", response_model=TokenPair)
async def callback(
    provider: str,
    session: DbSession,
    code: str = Query(...),
    state: str = Query(...),
) -> TokenPair:
    _provider_or_404(provider)
    try:
        stored = await oauth.consume_state(provider, state)
        token = await oauth.exchange_code(
            provider, code=code, code_verifier=str(stored["code_verifier"])
        )
        profile = await oauth.fetch_profile(provider, token)
    except oauth.OAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    link_user_id = stored.get("link_user_id")

    existing = await accounts.get_oauth_account(
        session, provider=provider, provider_user_id=profile.provider_user_id
    )

    # --- linking an additional provider to a signed-in user --------------------
    if link_user_id:
        user = await accounts.get_user_by_id(session, uuid.UUID(str(link_user_id)))
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
        if existing is not None and existing.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"this {provider} identity is already linked to another Rolewire account",
            )
        if existing is None:
            await accounts.link_oauth_account(
                session,
                user=user,
                provider=provider,
                provider_user_id=profile.provider_user_id,
                provider_email=profile.email,
                raw_profile=profile.raw,
            )
        return _token_pair(user)

    # --- 1. known identity ----------------------------------------------------
    if existing is not None:
        user = await accounts.get_user_by_id(session, existing.user_id)
        if user is None:  # pragma: no cover - FK cascade guarantees this
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
        return _token_pair(user)

    if not profile.email:
        # Facebook can withhold email even after login consent.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{provider} did not return an email address; sign up with an email and "
                f"password first, then link {provider} from account settings"
            ),
        )

    match = await accounts.get_user_by_email(session, profile.email)

    # --- 2/3. email matches an existing account -------------------------------
    if match is not None:
        if not profile.email_verified:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"an account already exists for {profile.email}. Because {provider} does not "
                    "verify email ownership, log in with your password and link "
                    f"{provider} from account settings"
                ),
            )
        await accounts.link_oauth_account(
            session,
            user=match,
            provider=provider,
            provider_user_id=profile.provider_user_id,
            provider_email=profile.email,
            raw_profile=profile.raw,
        )
        if profile.avatar_url and not match.avatar_url:
            match.avatar_url = profile.avatar_url
        return _token_pair(match)

    # --- 4. first-time social signup -----------------------------------------
    company_name = profile.name or profile.email.split("@")[0]
    _, user = await accounts.create_tenant_with_owner(
        session,
        email=profile.email,
        company_name=company_name,
        password=None,
        oauth={
            "provider": provider,
            "provider_user_id": profile.provider_user_id,
            "provider_email": profile.email,
            "raw_profile": profile.raw,
        },
        email_verified=profile.email_verified,
        avatar_url=profile.avatar_url,
    )
    return _token_pair(user)


__all__ = ["router"]
