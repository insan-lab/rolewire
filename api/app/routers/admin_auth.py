"""Admin authentication: password login, refresh, and OAuth link management (§5.2, §5.3)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import set_tenant_context
from app.core.rate_limit import hit
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    needs_rehash,
    verify_password,
)
from app.models import Tenant, User
from app.routers.deps import CurrentPrincipal, DbSession
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    TokenPair,
    UserOut,
)
from app.services import accounts

router = APIRouter(prefix="/v1/admin/auth", tags=["admin:auth"])


def _token_pair(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(
            user_id=str(user.id), tenant_id=str(user.tenant_id), role=user.role
        ),
        refresh_token=create_refresh_token(user_id=str(user.id), tenant_id=str(user.tenant_id)),
        expires_in=get_settings().access_token_ttl_seconds,
    )


def _user_out(user: User, providers: list[str]) -> UserOut:
    return UserOut(
        id=user.id,
        tenant_id=user.tenant_id,
        company_name=user.tenant.name if getattr(user, "tenant", None) else None,
        company_slug=user.tenant.slug if getattr(user, "tenant", None) else None,
        email=user.email,
        email_verified=user.email_verified,
        avatar_url=user.avatar_url,
        role=user.role,
        created_at=user.created_at,
        has_password=bool(user.password_hash),
        oauth_providers=providers,
    )


@router.post("/signup", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, session: DbSession) -> TokenPair:
    try:
        _, user = await accounts.create_tenant_with_owner(
            session,
            email=payload.email,
            company_name=payload.company_name,
            slug=payload.slug,
            password=payload.password,
        )
    except accounts.EmailAlreadyRegistered as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="email already registered"
        ) from exc
    return _token_pair(user)


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest, session: DbSession) -> TokenPair:
    # Throttle credential stuffing per email; the generic error below avoids user enumeration.
    throttle = await hit(f"login:{payload.email.lower()}", limit=10, window_seconds=300)
    if not throttle.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="too many login attempts",
            headers={"Retry-After": str(throttle.retry_after)},
        )

    user = await accounts.get_user_by_email(session, payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid email or password"
        )
    if user.password_hash and needs_rehash(user.password_hash):
        await set_tenant_context(session, user.tenant_id)
        user.password_hash = hash_password(payload.password)
    return _token_pair(user)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, session: DbSession) -> TokenPair:
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc

    tenant_id = uuid.UUID(claims["tenant_id"])
    await set_tenant_context(session, tenant_id)
    user = await session.scalar(select(User).where(User.id == uuid.UUID(claims["sub"])))
    if user is None or user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="token subject no longer exists"
        )
    tenant = await session.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if tenant is None or tenant.status == "suspended":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="tenant is suspended")
    return _token_pair(user)


@router.get("/me", response_model=UserOut)
async def me(principal: CurrentPrincipal, session: DbSession) -> UserOut:
    providers = await accounts.linked_providers(session, principal.user.id)
    return _user_out(principal.user, providers)


@router.delete("/oauth/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_oauth(
    provider: str, principal: CurrentPrincipal, session: DbSession
) -> None:
    try:
        await accounts.unlink_provider(session, principal.user, provider)
    except accounts.InvalidLoginMethod as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except accounts.AccountError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


__all__ = ["router"]
